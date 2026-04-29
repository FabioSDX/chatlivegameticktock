const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCALE = 4;

const dirs = ['block', 'pickaxe'];

async function revertDir(dir) {
    const dirPath = dir;
    if (!fs.existsSync(dirPath)) {
        console.log(`Diretório não encontrado: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
    console.log(`\n📁 Revertendo sem normalização em ${dir} (${files.length} arquivos)...`);

    for (const file of files) {
        const inputPath = path.join(dirPath, file);
        const tempPath = path.join(dirPath, '_temp_' + file);

        try {
            const metadata = await sharp(inputPath).metadata();
            const newWidth = metadata.width * SCALE;
            const newHeight = metadata.height * SCALE;

            // Sem normalize() que escurece
            await sharp(inputPath)
                .resize(newWidth, newHeight, {
                    kernel: 'lanczos3',
                    fit: 'fill'
                })
                .sharpen({
                    sigma: 0.8,
                    m1: 0.6,
                    m2: 0.6
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
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }
}

async function main() {
    console.log('🚀 Revertendo com brilho correto...\n');

    const baseDir = 'C:\\laragon8\\www\\fallingpickaxeticktock';
    for (const dir of dirs) {
        await revertDir(path.join(baseDir, dir));
    }

    console.log('\n✅ Concluído! (sem normalização de contraste)');
}

main().catch(console.error);