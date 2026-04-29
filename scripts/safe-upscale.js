const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCALE = 4;

const dirs = ['block', 'pickaxe'];

async function optimizeDir(dir) {
    const dirPath = dir;
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
    console.log(`\n📁 Otimizando ${dir} (${files.length} arquivos)...`);

    for (const file of files) {
        const inputPath = path.join(dirPath, file);
        const tempPath = path.join(dirPath, '_temp_' + file);

        try {
            const metadata = await sharp(inputPath).metadata();
            const newWidth = metadata.width * SCALE;
            const newHeight = metadata.height * SCALE;

            // Sem normalize() - apenas upscale + sharpen leve
            await sharp(inputPath)
                .resize(newWidth, newHeight, {
                    kernel: 'lanczos3',
                    fit: 'fill'
                })
                .sharpen({
                    sigma: 0.5,
                    m1: 0.3,
                    m2: 0.3
                })
                .png({
                    compressionLevel: 0,
                    adaptiveFiltering: false,
                    palette: false
                })
                .toFile(tempPath);

            fs.unlinkSync(inputPath);
            fs.renameSync(tempPath, inputPath);

            console.log(`  ✅ ${file}: ${metadata.width}x${metadata.height} -> ${newWidth}x${newHeight}`);
        } catch (err) {
            console.log(`  ❌ ${file}: ${err.message}`);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
    }
}

async function main() {
    console.log('🚀 Otimizando sprites (sem escurecer)...\n');
    console.log(`Escala: ${SCALE}x (sem normalize)`);

    const baseDir = 'C:\\laragon8\\www\\fallingpickaxeticktock';
    for (const dir of dirs) {
        await optimizeDir(path.join(baseDir, dir));
    }

    console.log('\n✅ Concluído! Cores originais preservadas.');
}

main().catch(console.error);