import { ActionPanel, Action, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { spawn } from "child_process";
import { basename, dirname, join, extname } from "path";
import { existsSync } from "fs";
import { useState, useEffect } from "react";

interface CompressFormValues {
 inputFile: string[];
 quality: string;
 preset: string;
}

export default function Command() {
 const [defaultFile, setDefaultFile] = useState<string[]>([]);
 const [fileType, setFileType] = useState<"video" | "audio" | "image" | null>(null);

 const FFMPEG_PATH = "/opt/homebrew/bin/ffmpeg";

 const QUALITY_PRESETS = {
   video: {
     lossless: "0",
     high: "18",
     medium: "23", 
     low: "28",
     "very low": "33"
   },
   audio: {
     lossless: "320",
     high: "256",
     medium: "192",
     low: "128",
     "very low": "96"
   },
   image: {
     lossless: "2",
     high: "5",
     medium: "10",
     low: "15",
     "very low": "20"
   }
 };

 useEffect(() => {
   async function getClipboardFile() {
     try {
       const clipboardContent = await Clipboard.read();
       if (clipboardContent?.file) {
         const filePath = decodeURIComponent(clipboardContent.file.replace(/^file:\/\/\//, ""));
         if (existsSync(filePath)) {
           const ext = extname(filePath).toLowerCase();
           if (ext.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
             setFileType("video");
             setDefaultFile([filePath]);
           } else if (ext.match(/\.(mp3|wav|aac|ogg|m4a|flac)$/i)) {
             setFileType("audio");
             setDefaultFile([filePath]);
           } else if (ext.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
             setFileType("image");
             setDefaultFile([filePath]);
           }
         }
       }
     } catch (error) {
       console.error("Error:", error);
     }
   }
   getClipboardFile();
 }, []);

 async function handleSubmit(values: CompressFormValues) {
   try {
     const inputPath = values.inputFile[0];
     const extension = extname(inputPath);
     const baseFileName = basename(inputPath, extension);
     const qualityValue = values.quality || QUALITY_PRESETS[fileType][values.preset];
     
     let outputPath: string;
     let ffmpegArgs: string[];

     switch (fileType) {
       case "video":
         outputPath = join(dirname(inputPath), `${baseFileName}.crf${qualityValue}${extension}`);
         ffmpegArgs = ['-i', inputPath, '-crf', qualityValue, '-preset', 'medium'];
         break;
       case "audio":
         outputPath = join(dirname(inputPath), `${baseFileName}.${qualityValue}kbps${extension}`);
         ffmpegArgs = ['-i', inputPath, '-b:a', `${qualityValue}k`];
         break;
       case "image":
         outputPath = join(dirname(inputPath), `${baseFileName}.q${qualityValue}${extension}`);
         ffmpegArgs = ['-i', inputPath, '-q:v', qualityValue];
         break;
       default:
         throw new Error("Unsupported file type");
     }

     ffmpegArgs.push('-y', outputPath);

     const toast = await showToast({
       style: Toast.Style.Animated,
       title: `Compressing ${fileType}...`,
     });

     await new Promise((resolve, reject) => {
       const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);
       let stderrData = "";

       ffmpeg.stderr.on('data', (data) => {
         stderrData += data;
         console.log('FFmpeg stderr:', data.toString());
       });

       ffmpeg.on('error', (error) => {
         reject(new Error(`Failed to start FFmpeg: ${error.message}`));
       });

       ffmpeg.on('close', (code) => {
         code === 0 ? resolve(true) : reject(new Error(`FFmpeg failed with code ${code}. Error: ${stderrData}`));
       });
     });

     toast.style = Toast.Style.Success;
     toast.title = `${fileType} compressed successfully`;
     toast.message = `Created ${basename(outputPath)}`;
   } catch (error) {
     console.error('Full error:', error);
     await showToast({
       style: Toast.Style.Failure,
       title: "Failed to compress file",
       message: error instanceof Error ? error.message : String(error),
     });
   }
 }

 function getQualityFieldProps() {
   switch (fileType) {
     case "video":
       return {
         placeholder: "23",
         info: "CRF value (0-51). Lower values = higher quality"
       };
     case "audio":
       return {
         placeholder: "128",
         info: "Bitrate in kbps. Lower values = smaller file size"
       };
     case "image":
       return {
         placeholder: "5",
         info: "Quality (2-31). Lower values = higher quality"
       };
     default:
       return {
         placeholder: "",
         info: "Select a file first"
       };
   }
 }

 return (
   <Form actions={<ActionPanel><Action.SubmitForm onSubmit={handleSubmit} /></ActionPanel>}>
     <Form.FilePicker
       id="inputFile"
       value={defaultFile}
       onChange={(files) => {
         setDefaultFile(files);
         const ext = extname(files[0]).toLowerCase();
         if (ext.match(/\.(mp4|mov|avi|mkv|webm)$/i)) setFileType("video");
         else if (ext.match(/\.(mp3|wav|aac|ogg|m4a|flac)$/i)) setFileType("audio");
         else if (ext.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) setFileType("image");
       }}
       title="File"
       allowMultipleSelection={false}
       canChooseDirectories={false}
     />
     <Form.Dropdown id="preset" title="Compression Level" defaultValue="medium">
       <Form.Dropdown.Item value="lossless" title="Lossless" />
       <Form.Dropdown.Item value="high" title="High Quality" />
       <Form.Dropdown.Item value="medium" title="Medium Quality" />
       <Form.Dropdown.Item value="low" title="Low Quality" />
       <Form.Dropdown.Item value="very low" title="Very Low Quality" />
     </Form.Dropdown>
     <Form.TextField
       id="quality"
       title="Custom Quality"
       {...getQualityFieldProps()}
     />
   </Form>
 );
}