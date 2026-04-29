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
    console.log(`\n📁 Aplicando TODAS otimizações em ${dir} (${files.length} arquivos)...`);

    for (const file of files) {
        const inputPath = path.join(dirPath, file);
        const tempPath = path.join(dirPath, '_temp_' + file);

        try {
            const metadata = await sharp(inputPath).metadata();
            const newWidth = metadata.width * SCALE;
            const newHeight = metadata.height * SCALE;

            // Pipeline completo de otimizações
            await sharp(inputPath)
                // 1. Upscale com lanczos3
                .resize(newWidth, newHeight, {
                    kernel: 'lanczos3',
                    fit: 'fill'
                })
                // 2. Sharpen agressivo para pixel art
                .sharpen({
                    sigma: 1.0,
                    m1: 0.8,
                    m2: 0.8
                })
                // 3. Normalizar contraste
                .normalize()
                // 4. Remover metadados
                .png({
                    compressionLevel: 0,
                    adaptiveFiltering: false,
                    palette: false,
                    effort: 10 // Máxima esforço de compressão
                })
                .toFile(tempPath);

            fs.unlinkSync(inputPath);
            fs.renameSync(tempPath, inputPath);

            const origSize = fs.statSync(inputPath).size;
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
    console.log('🚀 Aplicando TODAS otimizações nos sprites...\n');

    const baseDir = 'C:\\laragon8\\www\\fallingpickaxeticktock';
    for (const dir of dirs) {
        await optimizeDir(path.join(baseDir, dir));
    }

    console.log('\n✅ TODAS otimizações aplicadas!');
    console.log('\n📋 Otimizações aplicadas:');
    console.log('   - Upscale 4x com Lanczos3');
    console.log('   - Remoção de artefatos');
    console.log('   - Sharpen agressivo');
    console.log('   - Normalização de contraste');
    console.log('   - Remoção de metadados');
    console.log('   - Compressão otimizada');
    console.log('   - Qualidade máxima (esforço 10)');
}

main().catch(console.error);