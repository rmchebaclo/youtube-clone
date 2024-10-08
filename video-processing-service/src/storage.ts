// 1. GCS file interactions 
// 2. Local file interactions

import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { promiseHooks } from 'v8';

const storage = new Storage();

const rawVideoBucketName = "rmchebaclo-raw-videos";
const processedVideoBucketName = "rmchebaclo-processed-videos";

const localRawVideoPath = "./raw-videos"
const localProcessedVideoPath = "./processed-videos"

// Creates local directories for raw and processed videos
// Ensures these folders exist by the time a containter is started up
// Important because files with always be saved to these folders
export function setupDirectories(){
    ensureDirectoryExistence(localRawVideoPath);
    ensureDirectoryExistence(localProcessedVideoPath);
}

/**
 * 
 * @param rawVideoName - The name of the file to convert from {@link localRawVideoPath}.
 * @param processedVideoName - The name of the file to convert to {@link localProcessedVideoPath}.
 * @returns A promise that resolves when the video has been converted 
 */
export function convertVideo(rawVideoName: string, processedVideoName: string){
    return new Promise<void>((resolve, reject) => {
        ffmpeg(`${localRawVideoPath}/${rawVideoName}`).outputOptions("-vf", "scale= 1:1080") // 1080p
    .on("end", () => {
      console.log("Video processing finished succesfully.");
      resolve();
    })
    .on("error", (err) => {
      console.log(`An error occured: ${err.message}`);
      reject(err);
    })
    .save(`${localProcessedVideoPath}/${processedVideoName}`)
    })
}

/**
 * @param filename - The name of the file to download from the
 * {@link rawVideoBucketName} bucket into the {@link localRawVideoPath} folder.
 * @returns A promise that resolves when the file has been downloaded.
 */
export async function downloadRawVideo(fileName: string){
    await storage.bucket(rawVideoBucketName)
        .file(fileName)
        .download({ destination : `${localRawVideoPath}/${fileName}` });
    
    console.log(
        `gs://${rawVideoBucketName}/${fileName} downloaded to ${localRawVideoPath}/${fileName}`
    )
}

/**
 * @param filename - The name of the file to upload from the 
 * {@link localProcessedVideoPath} folder into the {@link processedVideoBucketName}.
 * @returns A promise that resolves when the file has been uploaded.
 */
export async function uploadProcesssedVideo(fileName: string){
    const bucket = storage.bucket(processedVideoBucketName);

    await bucket.upload(`${localProcessedVideoPath}/${fileName}`, {
        destination: fileName
    });
    console.log(
        `gs://${localProcessedVideoPath}/${fileName} uploaded to ${processedVideoBucketName}/${fileName}`
    )
    // specifying we want a file uploaded to this processed bucket to be public since it isn't by default
    await bucket.file(fileName).makePublic();
}

/**
 * @param filePath - The path of the file to delete.
 * @returns A promise that resolves when the file has been deleted.
 */
function deleteFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(filePath)) {
            // quickest way to delete file without updating disk space
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.log(`Failed to delete file at ${filePath}`, err);
                    reject(err);
                } else {
                    console.log(`File deleted at ${filePath}`);
                    resolve();
                }
            })
        } else {
            console.log(`File not found at ${filePath}. skipping the delete.`)
            resolve();
        }
    })
}

/**
 * @param fileName - The name of the file to delete from the 
 * {@link localRawVideoPath} folder.
 * @returns A promise that resolves when the file has been deleted
 */
export function deleteRawVideo(fileName: string) {
    return deleteFile(`${localRawVideoPath}/${fileName}`);
}

/**
 * @param fileName- The name of the file to delete from the
 * {@link localProcessedVideoPath} folder.
 * @returns A promise that resolves when the file has been deleted
 */
export function deleteProcessedVideo(fileName: string) {
    return deleteFile(`${localProcessedVideoPath}/${fileName}`)
}

/** 
 * Ensures a directory exists, creating it if neccesary.
 * @param {string} dirPath - The directory path to check.
 */
function ensureDirectoryExistence(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true}); // enables creating nested directories
        console.log(`Directory created at ${dirPath}`);
    }
}