const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Voltar ao tamanho original sem upscale
const dirs = ['block', 'pickaxe'];

async function restoreOriginal(dir) {
    const dirPath = dir;
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
    console.log(`\n📁 Restaurando tamanho original ${dir}...`);

    for (const file of files) {
        const inputPath = path.join(dirPath, file);
        const tempPath = path.join(dirPath, '_temp_' + file);
        
        // Primeiro ler a imagem atual e verificar tamanho
        try {
            const metadata = await sharp(inputPath).metadata();
            // Se já é 16x16, pular
            if (metadata.width === 16 && metadata.height === 16) {
                console.log(`  ⏭️ ${file}: já é 16x16`);
                continue;
            }
            
            // Se maior, reduzir para 16x16
            const newWidth = 16;
            const newHeight = 16;
            
            await sharp(inputPath)
                .resize(newWidth, newHeight, {
                    kernel: 'nearest', // Nearest neighbor para pixel art
                    fit: 'fill'
                })
                .png({
                    compressionLevel: 0
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
    console.log('🔄 Restaurando sprites para tamanho original...\n');
    const baseDir = 'C:\\laragon8\\www\\fallingpickaxeticktock';
    for (const dir of dirs) {
        await restoreOriginal(path.join(baseDir, dir));
    }
    console.log('\n✅ Sprites restaurados para 16x16!');
}

main().catch(console.error);