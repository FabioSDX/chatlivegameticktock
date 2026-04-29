const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCALE = 4; // Upscale de 4x (16x16 -> 64x64, 32x32 -> 128x128)

const dirs = ['block', 'pickaxe'];

async function upscaleDir(dir) {
    const dirPath = dir;
    if (!fs.existsSync(dirPath)) {
        console.log(`Diretório não encontrado: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
    console.log(`\n📁 Processando ${dir} (${files.length} arquivos)...`);

    for (const file of files) {
        const inputPath = path.join(dirPath, file);
        const tempPath = path.join(dirPath, '_temp_' + file);

        try {
            const metadata = await sharp(inputPath).metadata();
            const newWidth = metadata.width * SCALE;
            const newHeight = metadata.height * SCALE;

            await sharp(inputPath)
                .resize(newWidth, newHeight, {
                    kernel: 'lanczos3',
                    fit: 'fill'
                })
                .png({ quality: 100 })
                .toFile(tempPath);

            // Substituir arquivo original
            fs.unlinkSync(inputPath);
            fs.renameSync(tempPath, inputPath);

            console.log(`  ✅ ${file}: ${metadata.width}x${metadata.height} -> ${newWidth}x${newHeight}`);
        } catch (err) {
            console.log(`  ❌ ${file}: ${err.message}`);
            // Limpar arquivo temporário se existir
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }
}

async function main() {
    console.log('🚀 Iniciando upscaling de sprites...\n');
    console.log(`Escala: ${SCALE}x`);

    const baseDir = 'C:\\laragon8\\www\\fallingpickaxeticktock';
    for (const dir of dirs) {
        await upscaleDir(path.join(baseDir, dir));
    }

    console.log('\n✅ Concluído!');
}

main().catch(console.error);