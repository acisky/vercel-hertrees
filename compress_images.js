const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// --- Configuration ---
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 200;
const DEFAULT_QUALITY = 75; // Used for formats like webp/jpeg
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff'];
// ---------------------

/**
 * Compresses a single image file.
 * @param {string} inputPath Path to the input image.
 * 'original' to keep original format).
 * @param {number} quality Compression quality (1-100).
 */
async function compressImage(inputPath, outputPath, width, height, quality) {
  try {
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    let imagePipeline = sharp(inputPath)
      .resize({
        width: width,
        height: height,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true
      });

    const ext = path.extname(outputPath).toLowerCase();

    // 根据文件格式应用特定的压缩设置
    if (ext === '.png') {
      // PNG 优化：使用调色板量化 (palette: true) 可以显著减小体积
      imagePipeline = imagePipeline.png({
        quality: quality,
        palette: true, 
        compressionLevel: 9,
        adaptiveFiltering: true
      });
    } else if (ext === '.jpg' || ext === '.jpeg') {
      imagePipeline = imagePipeline.jpeg({
        quality: quality,
        mozjpeg: true // 使用 mozjpeg 算法获得更好的压缩
      });
    } else if (ext === '.webp') {
      imagePipeline = imagePipeline.webp({
        quality: quality
      });
    } else if (ext === '.gif') {
        imagePipeline = imagePipeline.gif();
    } else if (ext === '.tiff') {
        imagePipeline = imagePipeline.tiff({
            quality: quality
        });
    }

    await imagePipeline.toFile(outputPath);

    console.log(`Compressed: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`Error processing ${inputPath}: ${error.message}`);
  }
}

/**
 * Processes all images in a directory.
 * @param {string} inputDir Path to the input directory.
 * @param {string} outputDir Path to the output directory.
 * @param {number} width Target width.
 * @param {number} quality Target quality.
 */
async function processDirectory(inputDir, outputDir, width, height, quality) {
  console.log(`Starting compression process...`);
  console.log(`Input directory: ${inputDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Target size: ${width}x${height}px`);
  console.log(`Target quality (approx): ${quality}`);

  try {
    const files = await fs.readdir(inputDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    if (imageFiles.length === 0) {
      console.log("No supported image files found in the input directory.");
      return;
    }

    console.log(`Found ${imageFiles.length} images to process.`);

    // Process images concurrently
    const processingPromises = imageFiles.map(file => {
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, file);
      return compressImage(inputPath, outputPath, width, height, quality);
    });

    await Promise.all(processingPromises);
    console.log("Compression process finished.");

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Input directory not found: ${inputDir}`);
    } else {
      console.error(`Error reading input directory: ${error.message}`);
    }
    process.exit(1); // Exit with error code
  }
}

// --- Main Execution ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputDir = args[0];
  const outputDir = args[1];
  const width = parseInt(args[2] || DEFAULT_WIDTH, 10);
  const height = parseInt(args[3] || DEFAULT_HEIGHT || width, 10);
  const quality = parseInt(args[4] || DEFAULT_QUALITY, 10);

  if (!inputDir || !outputDir) {
    console.error("Usage: node compress_images.js <input_directory> <output_directory> [width] [height] [quality]");
    console.error("\nExample: node compress_images.js .\\public\\thumb .\\public\\thumb_small 200 200 75");
    process.exit(1);
  }

  if (isNaN(width) || width <= 0) {
    console.error(`Invalid width provided: ${args[2]}. Using default: ${DEFAULT_WIDTH}px`);
    process.exit(1);
  }
  if (isNaN(height) || height <= 0) {
    console.error(`Invalid height provided: ${args[3]}. Using default: ${DEFAULT_HEIGHT}px`);
    process.exit(1);
  }
  if (isNaN(quality) || quality < 1 || quality > 100) {
    console.error(`Invalid quality provided: ${args[4]}. Must be between 1-100. Using default: ${DEFAULT_QUALITY}`);
    process.exit(1);
  }

  processDirectory(inputDir, outputDir, width, height, quality);
}

// Export functions if needed as a module elsewhere
module.exports = {
    compressImage,
    processDirectory
};