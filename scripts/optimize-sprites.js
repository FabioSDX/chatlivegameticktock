const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCALE = 4;

const dirs = ['block', 'pickaxe'];

async function optimizeDir(dir) {
    const dirPath = dir;
    if (!fs.existsSync(dirPath)) {
        console.log(`Diretório não encontrado: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
    console.log(`\n📁 Otimizando ${dir} (${files.length} arquivos)...`);

    for (const file of files) {
        const inputPath = path.join(dirPath, file);
        const tempPath = path.join(dirPath, '_temp_' + file);

        try {
            const metadata = await sharp(inputPath).metadata();
            const newWidth = metadata.width * SCALE;
            const newHeight = metadata.height * SCALE;

            // Pipeline de otimização
            await sharp(inputPath)
                // 1. Upscale com lanczos3 (melhor qualidade)
                .resize(newWidth, newHeight, {
                    kernel: 'lanczos3',
                    fit: 'fill'
                })
                // 2. Aumentar nitidez (sharpen)
                .sharpen({
                    sigma: 0.5,
                    m1: 0.5,
                    m2: 0.5
                })
                // 3. Remover metadados desnecessários
                .png({
                    compressionLevel: 0, // Sem compressão para máxima qualidade
                    adaptiveFiltering: false,
                    palette: false // RGB completo
                })
                .toFile(tempPath);

            fs.unlinkSync(inputPath);
            fs.renameSync(tempPath, inputPath);

            console.log(`  ✅ ${file}: ${metadata.width}x${metadata.height} -> ${newWidth}x${newHeight} (otimizado)`);
        } catch (err) {
            console.log(`  ❌ ${file}: ${err.message}`);
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }
}

async function main() {
    console.log('🚀 Otimizando sprites com sharpening...\n');
    console.log(`Escala: ${SCALE}x + Sharpen + Qualidade máxima`);

    const baseDir = 'C:\\laragon8\\www\\fallingpickaxeticktock';
    for (const dir of dirs) {
        await optimizeDir(path.join(baseDir, dir));
    }

    console.log('\n✅ Concluído!');
    console.log('\n📋 Otimizações aplicadas:');
    console.log('   - Upscale 4x com Lanczos3');
    console.log('   - Sharpen para nitidez');
    console.log('   - Compressão zero (máxima qualidade)');
}

main().catch(console.error);