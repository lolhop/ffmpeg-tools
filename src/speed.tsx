import { ActionPanel, Action, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { spawn } from "child_process";
import { basename, dirname, join, extname } from "path";
import { existsSync } from "fs";
import { useState, useEffect } from "react";

interface SpeedFormValues {
 inputFile: string[];
 speed: string;
 maintainPitch?: boolean;
 customAudioSpeed?: string;
}

export default function Command() {
 const [defaultFile, setDefaultFile] = useState<string[]>([]);
 const [fileType, setFileType] = useState<"video" | "audio" | null>(null);

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
           } else if (ext.match(/\.(mp3|m4a|wav|aac|ogg)$/i)) {
             setFileType("audio");
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

 const FFMPEG_PATH = "/opt/homebrew/bin/ffmpeg";

 async function handleSubmit(values: SpeedFormValues) {
   try {
     const inputPath = values.inputFile[0];
     const extension = extname(inputPath);
     const baseFileName = basename(inputPath, extension);
     const speed = parseFloat(values.speed);
     
     let outputPath: string;
     let ffmpegArgs: string[];

     if (fileType === "video") {
       const audioSpeed = values.customAudioSpeed ? parseFloat(values.customAudioSpeed) : speed;
       let speedSuffix = `${speed}x`;
       if (audioSpeed !== speed) {
         speedSuffix += `.a${audioSpeed}x`;
       }
       if (values.maintainPitch) {
         speedSuffix += ".pitch";
       }
       
       outputPath = join(dirname(inputPath), `${baseFileName}.${speedSuffix}${extension}`);
       
       const pts = 1 / speed;
       const videoFilter = `setpts=${pts}*PTS`;
       const audioFilter = values.maintainPitch
         ? `asetrate=44100*${audioSpeed},aresample=44100,atempo=1`
         : `atempo=${audioSpeed}`;

       ffmpegArgs = [
         "-i", inputPath,
         "-filter:v", videoFilter,
         "-filter:a", audioFilter
       ];
     } else {
       const speedSuffix = `${speed}x`;
       outputPath = join(dirname(inputPath), `${baseFileName}.${speedSuffix}${extension}`);
       ffmpegArgs = ['-i', inputPath, '-filter:a', `atempo=${speed}`];
     }

     ffmpegArgs.push('-y', outputPath);

     const toast = await showToast({
       style: Toast.Style.Animated,
       title: `Changing ${fileType} speed...`,
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
     toast.title = `${fileType} speed modified successfully`;
     toast.message = `Created ${basename(outputPath)}`;
   } catch (error) {
     console.error('Full error:', error);
     await showToast({
       style: Toast.Style.Failure,
       title: "Failed to modify speed",
       message: error instanceof Error ? error.message : String(error),
     });
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
         else if (ext.match(/\.(mp3|m4a|wav|aac|ogg)$/i)) setFileType("audio");
       }}
       title={`${fileType || 'Media'} File`}
       allowMultipleSelection={false}
       canChooseDirectories={false}
       types={fileType === "video" ? ["public.movie"] : ["public.audio"]}
     />
     <Form.Dropdown id="speed" title="Speed" defaultValue="2.0">
       <Form.Dropdown.Item value="0.25" title="0.25x (Very Slow)" />
       <Form.Dropdown.Item value="0.5" title="0.5x (Slow Motion)" />
       <Form.Dropdown.Item value="0.75" title="0.75x (Slightly Slow)" />
       <Form.Dropdown.Item value="1.5" title="1.5x (Slightly Fast)" />
       <Form.Dropdown.Item value="2.0" title="2x (Double Speed)" />
       <Form.Dropdown.Item value="3.0" title="3x (Triple Speed)" />
       <Form.Dropdown.Item value="4.0" title="4x (Quadruple Speed)" />
     </Form.Dropdown>
     {fileType === "video" && (
       <>
         <Form.TextField
           id="customAudioSpeed"
           title="Custom Audio Speed (Optional)"
           placeholder="Same as video speed if empty"
           info="Different speed for audio track (e.g., 1.0 for normal speed audio)"
         />
         <Form.Checkbox
           id="maintainPitch"
           label="Maintain Audio Pitch"
           defaultValue={false}
           info="Keep original pitch when changing speed (may affect quality)"
         />
       </>
     )}
   </Form>
 );
}