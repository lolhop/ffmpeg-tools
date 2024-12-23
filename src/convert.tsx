import { ActionPanel, Action, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { spawn } from "child_process";
import { basename, dirname, join, extname } from "path";
import { existsSync } from "fs";
import { useState, useEffect } from "react";

interface ConvertFormValues {
 inputFile: string[];
 format: string;
 codec?: string;
 quality?: string;
 maintainQuality?: boolean;
}

export default function Command() {
 const [defaultFile, setDefaultFile] = useState<string[]>([]);
 const [fileType, setFileType] = useState<"video" | "audio" | "image" | null>(null);
 const [maintainQuality, setMaintainQuality] = useState(false);

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

 const FFMPEG_PATH = "/opt/homebrew/bin/ffmpeg";

 async function handleSubmit(values: ConvertFormValues) {
   try {
     const inputPath = values.inputFile[0];
     const baseFileName = basename(inputPath, extname(inputPath));
     let outputName = baseFileName;
     let args = ['-i', inputPath];

     if (fileType === "video") {
       if (values.codec === "libvpx-vp9") {
         args.push('-c:v', 'libvpx-vp9', '-b:v', '0');
         if (!values.maintainQuality) {
           args.push('-crf', values.quality || '30', '-row-mt', '1');
           outputName += `.${values.codec}.q${values.quality || '30'}`;
         } else {
           args.push('-crf', '0', '-row-mt', '1', '-cpu-used', '0');
           outputName += `.${values.codec}.lossless`;
         }
         args.push('-c:a', 'libopus');
       } else if (values.codec && values.codec !== "copy") {
         args.push('-c:v', values.codec);
         outputName += `.${values.codec}`;
         if (!values.maintainQuality) {
           if (values.codec === "libx264" || values.codec === "libx265") {
             args.push('-crf', values.quality || '23');
             outputName += `.q${values.quality || '23'}`;
           }
         } else {
           if (values.codec === "libx264" || values.codec === "libx265") {
             args.push('-crf', '0', '-preset', 'veryslow');
             outputName += '.lossless';
           }
         }
         args.push('-c:a', 'copy');
       } else {
         args.push('-c:v', 'copy', '-c:a', 'copy');
       }
     } else if (fileType === "audio") {
       if (!values.maintainQuality) {
         if (values.quality) {
           args.push('-b:a', `${values.quality}k`);
           outputName += `.${values.quality}k`;
         }
       } else {
         args.push('-c:a', 'flac', '-compression_level', '12');
         outputName += '.lossless';
       }
     } else if (fileType === "image") {
       if (!values.maintainQuality) {
         if (values.quality) {
           args.push('-q:v', values.quality);
           outputName += `.q${values.quality}`;
         }
       } else {
         args.push('-q:v', '1');
         outputName += '.max';
       }
     }

     const outputPath = join(dirname(inputPath), `${outputName}.${values.format}`);
     args.push('-y', outputPath);

     const toast = await showToast({
       style: Toast.Style.Animated,
       title: `Converting ${fileType}...`,
     });

     await new Promise((resolve, reject) => {
       const ffmpeg = spawn(FFMPEG_PATH, args);
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
     toast.title = "Conversion successful";
     toast.message = `Created ${basename(outputPath)}`;
   } catch (error) {
     console.error('Full error:', error);
     await showToast({
       style: Toast.Style.Failure,
       title: "Failed to convert",
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
         else if (ext.match(/\.(mp3|wav|aac|ogg|m4a|flac)$/i)) setFileType("audio");
         else if (ext.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) setFileType("image");
       }}
       title={`${fileType || 'Media'} File`}
       allowMultipleSelection={false}
       canChooseDirectories={false}
     />
     {fileType && (
       <>
         {fileType === "video" && (
           <>
             <Form.Dropdown id="format" title="Output Format" defaultValue="mp4">
               <Form.Dropdown.Item value="mp4" title="MP4 (H.264)" />
               <Form.Dropdown.Item value="webm" title="WebM (VP9)" />
               <Form.Dropdown.Item value="mkv" title="MKV" />
               <Form.Dropdown.Item value="mov" title="MOV" />
               <Form.Dropdown.Item value="avi" title="AVI" />
             </Form.Dropdown>
             <Form.Dropdown id="codec" title="Codec" defaultValue="libx264">
               <Form.Dropdown.Item value="libx264" title="H.264" />
               <Form.Dropdown.Item value="libx265" title="H.265/HEVC" />
               <Form.Dropdown.Item value="libvpx-vp9" title="VP9" />
               <Form.Dropdown.Item value="copy" title="Copy (No Re-encode)" />
             </Form.Dropdown>
           </>
         )}
         {fileType === "audio" && (
           <Form.Dropdown id="format" title="Output Format" defaultValue="mp3">
             <Form.Dropdown.Item value="mp3" title="MP3" />
             <Form.Dropdown.Item value="wav" title="WAV" />
             <Form.Dropdown.Item value="aac" title="AAC" />
             <Form.Dropdown.Item value="ogg" title="OGG" />
             <Form.Dropdown.Item value="flac" title="FLAC" />
           </Form.Dropdown>
         )}
         {fileType === "image" && (
           <Form.Dropdown id="format" title="Output Format" defaultValue="jpg">
             <Form.Dropdown.Item value="jpg" title="JPEG" />
             <Form.Dropdown.Item value="png" title="PNG" />
             <Form.Dropdown.Item value="webp" title="WebP" />
             <Form.Dropdown.Item value="gif" title="GIF" />
             <Form.Dropdown.Item value="bmp" title="BMP" />
           </Form.Dropdown>
         )}
         <Form.Checkbox
           id="maintainQuality"
           label="Maximum Quality"
           value={maintainQuality}
           onChange={setMaintainQuality}
           info={
             fileType === "video" ? "Uses lossless H.264 encoding" :
             fileType === "audio" ? "Uses FLAC with maximum compression" :
             "Uses highest quality settings"
           }
         />
         {!maintainQuality && (
           <Form.TextField
             id="quality"
             title="Quality"
             placeholder={
               fileType === "video" ? "23" : 
               fileType === "audio" ? "192" : "5"
             }
             info={
               fileType === "video" ? "CRF value (0-51). Lower = higher quality" :
               fileType === "audio" ? "Bitrate in kbps" :
               "Quality (2-31). Lower = higher quality"
             }
           />
         )}
       </>
     )}
   </Form>
 );
}