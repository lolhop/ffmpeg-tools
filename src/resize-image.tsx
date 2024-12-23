import { ActionPanel, Action, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { spawn } from "child_process";
import { basename, dirname, join, extname } from "path";
import { existsSync } from "fs";
import { useState, useEffect } from "react";

interface ResizeImageFormValues {
 inputFile: string[];
 width: string;
 height: string;
 maintainAspectRatio: boolean;
 quality: string;
 filter: string;
}

export default function Command() {
 const [defaultFile, setDefaultFile] = useState<string[]>([]);

 useEffect(() => {
   async function getClipboardFile() {
     try {
       const clipboardContent = await Clipboard.read();
       if (clipboardContent?.file) {
         const filePath = decodeURIComponent(clipboardContent.file.replace(/^file:\/\/\//, ""));
         if (existsSync(filePath) && filePath.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
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

 async function handleSubmit(values: ResizeImageFormValues) {
   try {
     const inputPath = values.inputFile[0];
     const extension = extname(inputPath);
     const baseFileName = basename(inputPath, extension);
     
     const resolution = values.maintainAspectRatio 
       ? `${values.width}w` 
       : `${values.width}x${values.height}`;
     
     const qualitySuffix = values.quality ? `.q${values.quality}` : '';
     
     const outputPath = join(
       dirname(inputPath),
       `${baseFileName}.${resolution}${qualitySuffix}${extension}`
     );

     const toast = await showToast({
       style: Toast.Style.Animated,
       title: "Resizing image...",
     });

     const scaleFilter = values.maintainAspectRatio
       ? `scale=${values.width}:-1:flags=${values.filter}`
       : `scale=${values.width}:${values.height}:flags=${values.filter}`;

     const args = ['-i', inputPath, '-vf', scaleFilter];

     if (values.quality) {
       args.push('-q:v', values.quality);
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
     toast.title = "Image resized successfully";
     toast.message = `Created ${basename(outputPath)}`;
   } catch (error) {
     console.error('Full error:', error);
     await showToast({
       style: Toast.Style.Failure,
       title: "Failed to resize image",
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
       title="Image File"
       allowMultipleSelection={false}
       canChooseDirectories={false}
       types={["public.image"]}
     />
     <Form.TextField
       id="width"
       title="Width"
       placeholder="1920"
     />
     <Form.TextField
       id="height"
       title="Height"
       placeholder="1080"
       info="Optional if maintaining aspect ratio"
     />
     <Form.Checkbox
       id="maintainAspectRatio"
       label="Maintain Aspect Ratio"
       defaultValue={true}
       info="Automatically calculate height based on width"
     />
     <Form.Dropdown id="filter" title="Scaling Algorithm" defaultValue="bicubic">
       <Form.Dropdown.Item value="bicubic" title="Bicubic (Best Quality)" />
       <Form.Dropdown.Item value="bilinear" title="Bilinear (Faster)" />
       <Form.Dropdown.Item value="neighbor" title="Nearest Neighbor (Pixel Art)" />
       <Form.Dropdown.Item value="lanczos" title="Lanczos (Sharp Edges)" />
     </Form.Dropdown>
     <Form.TextField
       id="quality"
       title="Quality (Optional)"
       placeholder="1-31"
       info="Lower values = higher quality. Leave empty for default."
     />
   </Form>
 );
}