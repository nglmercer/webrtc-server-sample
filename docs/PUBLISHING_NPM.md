# Publicación en NPM con Rama de Distribución

## Problema

El directorio `dist/` está incluido en `.gitignore` para mantener el repositorio limpio, pero NPM necesita acceso a los archivos compilados para la distribución del paquete.

## Solución: Rama de Distribución

### Opción 1: Rama Manual de Distribución

#### Paso 1: Crear y configurar la rama de distribución

```bash
# Crear una nueva rama para distribución
git checkout -b dist-branch

# Eliminar dist/ del .gitignore temporalmente
cp .gitignore .gitignore.backup
sed -i '/dist\//d' .gitignore

# Compilar el proyecto
npm run build

# Agregar archivos de distribución
git add dist/
git add .gitignore
git commit -m "Add dist files for npm publishing"

# Restaurar .gitignore original
mv .gitignore.backup .gitignore
git add .gitignore
git commit -m "Restore original .gitignore"
```

#### Paso 2: Publicar desde la rama de distribución

```bash
# Asegurarse de estar en la rama de distribución
git checkout dist-branch

# Publicar en NPM
npm publish

# Volver a la rama principal
git checkout main
```

### Opción 2: Script Automatizado

Crear un script `scripts/publish-npm.js`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

function publishToNpm() {
  try {
    console.log('🔨 Compilando proyecto...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('🌿 Creando rama de distribución...');
    execSync('git checkout -b temp-dist-branch', { stdio: 'inherit' });
    
    // Crear .gitignore temporal sin dist/
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const tempGitignore = gitignore.replace(/^dist\/$/m, '');
    fs.writeFileSync('.gitignore', tempGitignore);
    
    console.log('📦 Agregando archivos de distribución...');
    execSync('git add dist/ .gitignore', { stdio: 'inherit' });
    execSync('git commit -m "Add dist files for npm publishing"', { stdio: 'inherit' });
    
    console.log('🚀 Publicando en NPM...');
    execSync('npm publish', { stdio: 'inherit' });
    
    console.log('🧹 Limpiando...');
    execSync('git checkout main', { stdio: 'inherit' });
    execSync('git branch -D temp-dist-branch', { stdio: 'inherit' });
    
    console.log('✅ Publicación completada exitosamente!');
  } catch (error) {
    console.error('❌ Error durante la publicación:', error.message);
    // Limpiar en caso de error
    try {
      execSync('git checkout main', { stdio: 'inherit' });
      execSync('git branch -D temp-dist-branch', { stdio: 'inherit' });
    } catch (cleanupError) {
      console.error('Error durante la limpieza:', cleanupError.message);
    }
    process.exit(1);
  }
}

publishToNpm();
```

### Opción 3: GitHub Actions (Recomendado)

Crear `.github/workflows/publish-npm.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build project
        run: npm run build
        
      - name: Create distribution branch
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git checkout -b dist-release
          
          # Modificar .gitignore temporalmente
          sed -i '/dist\//d' .gitignore
          
          git add dist/ .gitignore
          git commit -m "Add dist files for release ${{ github.event.release.tag_name }}"
          
      - name: Publish to NPM
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Configuración del package.json

Asegúrate de que tu `package.json` tenga la configuración correcta:

```json
{
  "main": "dist/index.js",
  "files": [
    "dist",
    "README.md",
    "README.ES.md"
  ],
  "scripts": {
    "prepublishOnly": "npm run build",
    "publish:manual": "node scripts/publish-npm.js"
  }
}
```

## Ventajas de este Enfoque

1. **Repositorio limpio**: El código fuente permanece sin archivos compilados
2. **NPM completo**: Los usuarios obtienen todos los archivos necesarios
3. **Versionado claro**: Separación entre desarrollo y distribución
4. **Automatización**: Puede integrarse con CI/CD

## Comandos Útiles

```bash
# Verificar qué archivos se incluirán en el paquete NPM
npm pack --dry-run

# Publicar en modo de prueba
npm publish --dry-run

# Publicar con tag específico
npm publish --tag beta
```

## Notas Importantes

- Siempre ejecuta `npm run build` antes de publicar
- Verifica que la versión en `package.json` sea correcta
- Considera usar `npm version` para actualizar versiones automáticamente
- Mantén el `.gitignore` original en la rama principal