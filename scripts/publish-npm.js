import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function run(command, options = {}) {
  return execSync(command, { stdio: "inherit", ...options });
}
function runSilent(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function loadConfig() {
  const defaultConfig = {
    buildCommand: "npm run build",
    outputDir: "dist",
    checkVersion: true,
    createGitTag: true,
    tempBranchPrefix: "temp-dist",
    dryRun: false,
  };

  const configPath = path.resolve("publish.config.json");
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }

  const args = process.argv.slice(2);
  const cliConfig = {
    dryRun: args.includes("--dry-run"),
  };

  return { ...defaultConfig, ...fileConfig, ...cliConfig };
}

function publishToNpm(config) {
  const {
    buildCommand,
    outputDir,
    checkVersion,
    createGitTag,
    tempBranchPrefix,
    dryRun,
  } = config;

  const originalBranch = runSilent("git branch --show-current");
  const tempBranch = `${tempBranchPrefix}-${Date.now()}`;

  try {
    console.log("🔍 Verificando estado del repositorio...");

    try {
      execSync("git diff --exit-code", { stdio: "pipe" });
      execSync("git diff --cached --exit-code", { stdio: "pipe" });
    } catch {
      console.error("❌ Hay cambios sin commitear.");
      process.exit(1);
    }

    if (checkVersion) {
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      const publishedVersions = runSilent(`npm view ${pkg.name} versions --json`);
      if (publishedVersions.includes(pkg.version)) {
        console.error(`❌ La versión ${pkg.version} ya está publicada.`);
        process.exit(1);
      }
    }

    console.log("🔨 Compilando proyecto...");
    run(buildCommand);

    if (!fs.existsSync(outputDir)) {
      console.error(`❌ Error: ${outputDir}/ no existe después del build.`);
      process.exit(1);
    }

    console.log(`🌿 Creando rama temporal: ${tempBranch}...`);
    run(`git checkout -b ${tempBranch}`);

    console.log("📦 Preparando archivos de distribución...");
    const stashResult = runSilent(`git diff --name-only ${outputDir}`);
    if (stashResult) {
      run(`git stash push -m 'temp-dist-stash' --include-untracked`);
      run(`git checkout stash -- ${outputDir}`);
      run(`git add -f ${outputDir}`);
    } else {
      console.log(`ℹ️ No hay cambios para stashear en ${outputDir}, usando el build directo...`);
      run(`git add -f ${outputDir}`);
    }

    run(`git commit -m "Add ${outputDir} files for npm publishing"`);

    console.log(dryRun ? "🚀 Simulando publicación..." : "🚀 Publicando en NPM...");
    run(`npm publish${dryRun ? " --dry-run" : ""}`);

    if (createGitTag && !dryRun) {
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      const tagName = `v${pkg.version}`;
      console.log(`🏷️ Creando tag ${tagName}...`);
      run(`git tag ${tagName}`);
      run(`git push origin ${tagName}`);
    }

    console.log("✅ Publicación completada!");
  } catch (error) {
    console.error("❌ Error durante la publicación:", error.message);
    process.exit(1);
  } finally {
    console.log("🧹 Restaurando estado...");
    try {
      run(`git checkout ${originalBranch}`);
      run(`git branch -D ${tempBranch}`);
      run("git stash pop || true");
      console.log("🎉 Limpieza completada.");
    } catch (cleanupError) {
      console.error("⚠️ Error en limpieza:", cleanupError.message);
    }
  }
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
📚 Script de Publicación NPM

Configura en publish.config.json o con argumentos CLI:

Opciones en JSON:
{
  "buildCommand": "npm run build",
  "outputDir": "dist",
  "checkVersion": true,
  "createGitTag": true,
  "tempBranchPrefix": "temp-dist",
  "dryRun": false
}

Argumentos CLI:
  --dry-run   Simular publicación
  --help      Mostrar ayuda
`);
  process.exit(0);
}

const config = loadConfig();
publishToNpm(config);
