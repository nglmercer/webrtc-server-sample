import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function publishToNpm() {
  const originalBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const tempBranch = `temp-dist-${Date.now()}`;
  
  try {
    console.log('🔍 Verificando estado del repositorio...');
    
    // Verificar que no hay cambios sin commitear
    try {
      execSync('git diff --exit-code', { stdio: 'pipe' });
      execSync('git diff --cached --exit-code', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Error: Hay cambios sin commitear. Por favor, haz commit de tus cambios antes de publicar.');
      process.exit(1);
    }
    
    console.log('🔨 Compilando proyecto...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Verificar que dist/ existe
    if (!fs.existsSync('dist')) {
      console.error('❌ Error: El directorio dist/ no existe después del build.');
      process.exit(1);
    }
    
    console.log(`🌿 Creando rama temporal: ${tempBranch}...`);
    execSync(`git checkout -b ${tempBranch}`, { stdio: 'inherit' });
    
    console.log('📝 Modificando .gitignore temporalmente...');
    // Crear backup del .gitignore
    const gitignorePath = '.gitignore';
    const gitignoreBackup = '.gitignore.backup';
    
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      fs.writeFileSync(gitignoreBackup, gitignoreContent);
      
      // Remover dist/ del .gitignore
      const modifiedContent = gitignoreContent
        .split('\n')
        .filter(line => line.trim() !== 'dist/')
        .join('\n');
      
      fs.writeFileSync(gitignorePath, modifiedContent);
    }
    
    console.log('📦 Agregando archivos de distribución...');
    execSync('git add dist/ .gitignore', { stdio: 'inherit' });
    
    // Verificar que hay cambios para commitear
    try {
      execSync('git diff --cached --exit-code', { stdio: 'pipe' });
      console.log('ℹ️  No hay cambios en dist/ para commitear.');
    } catch (error) {
      // Hay cambios, proceder con el commit
      execSync('git commit -m "Add dist files for npm publishing"', { stdio: 'inherit' });
    }
    
    console.log('🚀 Publicando en NPM...');
    execSync('npm publish', { stdio: 'inherit' });
    
    console.log('✅ Publicación completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la publicación:', error.message);
    process.exit(1);
  } finally {
    console.log('🧹 Limpiando...');
    
    try {
      // Volver a la rama original
      execSync(`git checkout ${originalBranch}`, { stdio: 'inherit' });
      
      // Eliminar rama temporal
      execSync(`git branch -D ${tempBranch}`, { stdio: 'inherit' });
      
      // Restaurar .gitignore si existe el backup
      if (fs.existsSync('.gitignore.backup')) {
        fs.renameSync('.gitignore.backup', '.gitignore');
      }
      
      console.log('🎉 Limpieza completada.');
    } catch (cleanupError) {
      console.error('⚠️  Error durante la limpieza:', cleanupError.message);
      console.log(`Por favor, ejecuta manualmente: git checkout ${originalBranch} && git branch -D ${tempBranch}`);
    }
  }
}

// Verificar argumentos de línea de comandos
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📚 Script de Publicación NPM

Uso: node scripts/publish-npm.js [opciones]

Opciones:
  --help, -h     Mostrar esta ayuda
  --dry-run      Ejecutar sin publicar realmente

Este script:
1. Compila el proyecto
2. Crea una rama temporal
3. Modifica .gitignore para incluir dist/
4. Publica en NPM
5. Limpia y vuelve a la rama original
`);
  process.exit(0);
}

if (args.includes('--dry-run')) {
  console.log('🔍 Modo dry-run: no se publicará realmente en NPM');
  // Aquí podrías modificar el script para no ejecutar npm publish
}

publishToNpm();