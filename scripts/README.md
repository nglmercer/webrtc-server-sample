# Scripts de Utilidad

## publish-npm.js

Script automatizado para publicar el paquete en NPM manteniendo el directorio `dist/` fuera del repositorio principal.

### Uso

```bash
# Publicación normal
npm run publish:npm

# Modo de prueba (no publica realmente)
npm run publish:dry-run

# Verificar contenido del paquete antes de publicar
npm run pack:check

# Ejecutar directamente
node scripts/publish-npm.js

# Ver ayuda
node scripts/publish-npm.js --help
```

### ¿Qué hace el script?

1. **Verifica el estado del repositorio**: Se asegura de que no hay cambios sin commitear
2. **Compila el proyecto**: Ejecuta `npm run build`
3. **Crea una rama temporal**: Para manejar los archivos de distribución
4. **Modifica .gitignore**: Temporalmente permite que `dist/` sea trackeado
5. **Agrega archivos de distribución**: Commitea los archivos compilados
6. **Publica en NPM**: Ejecuta `npm publish`
7. **Limpia**: Vuelve a la rama original y elimina la rama temporal

### Requisitos

- Node.js instalado
- Git configurado
- Cuenta de NPM configurada (`npm login`)
- Proyecto compilado correctamente

### Solución de Problemas

#### Error: "Hay cambios sin commitear"
```bash
# Commitea tus cambios primero
git add .
git commit -m "Tu mensaje de commit"
```

#### Error: "El directorio dist/ no existe"
```bash
# Asegúrate de que el build funciona
npm run build
```

#### Error durante la limpieza
```bash
# Limpieza manual si es necesario
git checkout main
git branch -D temp-dist-[timestamp]
```

### Configuración Adicional

Para configurar la autenticación de NPM:

```bash
# Iniciar sesión en NPM
npm login

# Verificar usuario actual
npm whoami

# Configurar registro (si es necesario)
npm config set registry https://registry.npmjs.org/
```

### Integración con CI/CD

Este script también puede usarse en pipelines de CI/CD. Ver el archivo `.github/workflows/publish-npm.yml` para un ejemplo con GitHub Actions.