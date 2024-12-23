import { ActionPanel, Action, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { spawn } from "child_process";
import { basename, dirname, join, extname } from "path";
import { existsSync } from "fs";
import { useState, useEffect } from "react";

interface ResizeFormValues {
  inputFile: string[];
  width: string;
  height?: string;
  maintainAspectRatio: boolean;
  filter: string;
  fileType: "image" | "video";
  quality?: string;
  preset?: string;
  keepAudioBitrate?: boolean;
}

export default function Command() {
  const [defaultFile, setDefaultFile] = useState<string[]>([]);
  const [fileType, setFileType] = useState<"image" | "video">("image");

  useEffect(() => {
    async function getClipboardFile() {
      try {
        const clipboardContent = await Clipboard.read();
        if (clipboardContent?.file) {
          const filePath = decodeURIComponent(clipboardContent.file.replace(/^file:\/\/\//, ""));
          if (existsSync(filePath)) {
            if (filePath.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
              setFileType("image");
              setDefaultFile([filePath]);
            } else if (filePath.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
              setFileType("video");
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

  async function handleSubmit(values: ResizeFormValues) {
    try {
      const inputPath = values.inputFile[0];
      const extension = extname(inputPath);
      const baseFileName = basename(inputPath, extension);
      
      // Handle scaling and output filename
      let resolution;
      let scaleFilter;

      if (values.fileType === 'video') {
        resolution = `${values.width}p`;
        scaleFilter = `scale=${values.width}:-2:flags=${values.filter}`;
      } else {
        if (values.height && !values.maintainAspectRatio) {
          resolution = `${values.width}x${values.height}`;
          scaleFilter = `scale=${values.width}:${values.height}:flags=${values.filter}`;
        } else {
          resolution = `${values.width}w`;
          scaleFilter = `scale=${values.width}:-1:flags=${values.filter}`;
        }
      }
      
      const qualitySuffix = values.fileType === 'image' && values.quality ? `.q${values.quality}` : '';
      const presetSuffix = values.fileType === 'video' && values.preset !== "medium" ? `.${values.preset}` : '';
      
      const sanitizedResolution = resolution.replace(/[^a-zA-Z0-9\.-]/g, '');
      const outputPath = join(
        dirname(inputPath),
        `${baseFileName}.${sanitizedResolution}${qualitySuffix}${presetSuffix}${extension}`
      );

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: `${values.fileType === 'image' ? 'Resizing image' : 'Changing video resolution'}...`,
      });

      const args = ['-i', inputPath, '-vf', scaleFilter];

      if (values.fileType === 'image' && values.quality) {
        args.push('-q:v', values.quality);
      } else if (values.fileType === 'video') {
        args.push('-preset', values.preset || 'medium');
        if (values.keepAudioBitrate) {
          args.push('-c:a', 'copy');
        }
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
      toast.title = values.fileType === 'image' 
        ? "Image resized successfully" 
        : "Video resolution changed successfully";
      toast.message = `Created ${basename(outputPath)}`;
    } catch (error) {
      console.error('Full error:', error);
      await showToast({
        style: Toast.Style.Failure,
        title: `Failed to ${values.fileType === 'image' ? 'resize image' : 'change video resolution'}`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form actions={<ActionPanel><Action.SubmitForm onSubmit={handleSubmit} /></ActionPanel>}>
      <Form.Dropdown id="fileType" title="File Type" value={fileType} onChange={(value) => setFileType(value as "image" | "video")}>
        <Form.Dropdown.Item value="image" title="Image" />
        <Form.Dropdown.Item value="video" title="Video" />
      </Form.Dropdown>
      <Form.FilePicker
        id="inputFile"
        value={defaultFile}
        onChange={setDefaultFile}
        title={`${fileType === 'image' ? 'Image' : 'Video'} File`}
        allowMultipleSelection={false}
        canChooseDirectories={false}
        types={[fileType === 'image' ? "public.image" : "public.movie"]}
      />
      {fileType === 'image' ? (
        <>
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
        </>
      ) : (
        <>
          <Form.Dropdown id="width" title="Resolution" defaultValue="1920">
            <Form.Dropdown.Item value="7680" title="8K (7680x4320)" />
            <Form.Dropdown.Item value="3840" title="4K (3840x2160)" />
            <Form.Dropdown.Item value="2560" title="2.5K (2560x1440)" />
            <Form.Dropdown.Item value="1920" title="Full HD (1920x1080)" />
            <Form.Dropdown.Item value="1440" title="HD+ (1440x1080)" />
            <Form.Dropdown.Item value="1280" title="HD (1280x720)" />
            <Form.Dropdown.Item value="854" title="480p (854x480)" />
            <Form.Dropdown.Item value="640" title="SD (640x360)" />
            <Form.Dropdown.Item value="426" title="240p (426x240)" />
            <Form.Dropdown.Item value="256" title="144p (256x144)" />
          </Form.Dropdown>
          <Form.Checkbox
            id="maintainAspectRatio"
            label="Maintain Aspect Ratio"
            defaultValue={true}
            info="Automatically calculate height based on width (recommended)"
          />
          <Form.Dropdown id="filter" title="Scaling Algorithm" defaultValue="bicubic">
            <Form.Dropdown.Item value="bicubic" title="Bicubic (Best Quality)" />
            <Form.Dropdown.Item value="bilinear" title="Bilinear (Faster)" />
            <Form.Dropdown.Item value="neighbor" title="Nearest Neighbor (Sharper)" />
            <Form.Dropdown.Item value="lanczos" title="Lanczos (Detailed)" />
          </Form.Dropdown>
          <Form.Dropdown id="preset" title="Encoding Speed" defaultValue="medium">
            <Form.Dropdown.Item value="veryslow" title="Very Slow (Best Quality)" />
            <Form.Dropdown.Item value="slow" title="Slow (Better Quality)" />
            <Form.Dropdown.Item value="medium" title="Medium (Default)" />
            <Form.Dropdown.Item value="fast" title="Fast (Lower Quality)" />
            <Form.Dropdown.Item value="veryfast" title="Very Fast (Lowest Quality)" />
          </Form.Dropdown>
          <Form.Checkbox
            id="keepAudioBitrate"
            label="Preserve Audio Quality"
            defaultValue={true}
            info="Keep original audio bitrate"
          />
        </>
      )}
    </Form>
  );
}