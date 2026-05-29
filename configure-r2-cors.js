const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const path = require("path");

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

async function configurarCors(prefix) {
  const accountId = process.env[`${prefix}_ACCOUNT_ID`];
  const accessKeyId = process.env[`${prefix}_ACCESS_KEY_ID`];
  const secretAccessKey = process.env[`${prefix}_SECRET_ACCESS_KEY`];
  const bucket = process.env[`${prefix}_BUCKET`];

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.error(`[${prefix}] Configuração incompleta no arquivo .env.local`);
    return;
  }

  console.log(`Configurando CORS para o bucket: ${bucket} (${prefix})...`);

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const corsRules = [
    {
      AllowedOrigins: ["http://localhost:3000", "https://dbg-eletrica-pintura.vercel.app"],
      AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: [],
      MaxAgeSeconds: 3000,
    },
  ];

  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: corsRules,
      },
    });

    await client.send(command);
    console.log(`Sucesso: Política de CORS atualizada para o bucket: ${bucket}`);
  } catch (error) {
    console.error(`Erro ao configurar CORS para o bucket ${bucket}:`, error);
  }
}

async function run() {
  await configurarCors("R2_PUBLIC");
  await configurarCors("R2_PRIVATE");
}

run();
