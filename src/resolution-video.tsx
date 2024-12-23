import { ActionPanel, Action, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { spawn } from "child_process";
import { basename, dirname, join, extname } from "path";
import { existsSync } from "fs";
import { useState, useEffect } from "react";

interface ResolutionVideoFormValues {
 inputFile: string[];
 width: string;
 height: string;
 maintainAspectRatio: boolean;
 preset: string;
 filter: string;
 keepAudioBitrate: boolean;
}

export default function Command() {
 const [defaultFile, setDefaultFile] = useState<string[]>([]);

 useEffect(() => {
   async function getClipboardFile() {
     try {
       const clipboardContent = await Clipboard.read();
       if (clipboardContent?.file) {
         const filePath = decodeURIComponent(clipboardContent.file.replace(/^file:\/\/\//, ""));
         if (existsSync(filePath) && filePath.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
           setDefaultFile([filePath]);
         }
       }
     } catch (error) {
       console.error("Error:", error);
     }
   }
   getClipboardFile();
 }, []);

 const FFMPEG_PATH = "/opt/homebrew/bin/ffmpeg";

 async function handleSubmit(values: ResolutionVideoFormValues) {
   try {
     const inputPath = values.inputFile[0];
     const extension = extname(inputPath);
     const baseFileName = basename(inputPath, extension);
     
     const resolution = values.maintainAspectRatio 
       ? `${values.width}p` 
       : `${values.width}x${values.height}`;
     
     const presetSuffix = values.preset !== "medium" ? `.${values.preset}` : '';
     
     const outputPath = join(
       dirname(inputPath),
       `${baseFileName}.${resolution}${presetSuffix}${extension}`
     );

     const toast = await showToast({
       style: Toast.Style.Animated,
       title: "Changing video resolution...",
     });

     const scaleFilter = values.maintainAspectRatio
       ? `scale=${values.width}:-2:flags=${values.filter}`
       : `scale=${values.width}:${values.height}:flags=${values.filter}`;

     const args = ['-i', inputPath, '-vf', scaleFilter, '-preset', values.preset];

     if (values.keepAudioBitrate) {
       args.push('-c:a', 'copy');
     }

     args.push('-y', outputPath);

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
     toast.title = "Video resolution changed successfully";
     toast.message = `Created ${basename(outputPath)}`;
   } catch (error) {
     console.error('Full error:', error);
     await showToast({
       style: Toast.Style.Failure,
       title: "Failed to change video resolution",
       message: error instanceof Error ? error.message : String(error),
     });
   }
 }

 return (
   <Form actions={<ActionPanel><Action.SubmitForm onSubmit={handleSubmit} /></ActionPanel>}>
     <Form.FilePicker
       id="inputFile"
       value={defaultFile}
       onChange={setDefaultFile}
       title="Video File"
       allowMultipleSelection={false}
       canChooseDirectories={false}
       types={["public.movie"]}
     />
     <Form.Dropdown id="width" title="Resolution" defaultValue="1920">
       <Form.Dropdown.Item value="3840" title="4K (3840x2160)" />
       <Form.Dropdown.Item value="2560" title="2.5K (2560x1440)" />
       <Form.Dropdown.Item value="1920" title="Full HD (1920x1080)" />
       <Form.Dropdown.Item value="1280" title="HD (1280x720)" />
       <Form.Dropdown.Item value="854" title="480p (854x480)" />
     </Form.Dropdown>
     <Form.TextField
       id="height"
       title="Custom Height"
       placeholder="1080"
       info="Optional if maintaining aspect ratio"
     />
     <Form.Checkbox
       id="maintainAspectRatio"
       label="Maintain Aspect Ratio"
       defaultValue={true}
       info="Automatically calculate height based on width (recommended)"
     />
     <Form.Dropdown id="preset" title="Encoding Speed" defaultValue="medium">
       <Form.Dropdown.Item value="veryslow" title="Very Slow (Best Quality)" />
       <Form.Dropdown.Item value="slow" title="Slow (Better Quality)" />
       <Form.Dropdown.Item value="medium" title="Medium (Default)" />
       <Form.Dropdown.Item value="fast" title="Fast (Lower Quality)" />
       <Form.Dropdown.Item value="veryfast" title="Very Fast (Lowest Quality)" />
     </Form.Dropdown>
     <Form.Dropdown id="filter" title="Scaling Algorithm" defaultValue="bicubic">
       <Form.Dropdown.Item value="bicubic" title="Bicubic (Best Quality)" />
       <Form.Dropdown.Item value="bilinear" title="Bilinear (Faster)" />
       <Form.Dropdown.Item value="neighbor" title="Nearest Neighbor (Sharper)" />
       <Form.Dropdown.Item value="lanczos" title="Lanczos (Detailed)" />
     </Form.Dropdown>
     <Form.Checkbox
       id="keepAudioBitrate"
       label="Preserve Audio Quality"
       defaultValue={true}
       info="Keep original audio bitrate"
     />
   </Form>
 );
}