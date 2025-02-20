const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();
const { Pool } = require("pg");

const app = express();

// Conectar ao banco de dados PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necessário para conexão segura no Render
  },
});
pool.connect()
  .then(() => console.log("Conectado ao banco de dados!"))
  .catch(err => console.error("Erro ao conectar ao banco:", err));

// Criação da tabela 'products' caso ela não exista
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image TEXT,
    category VARCHAR(100),
    colors TEXT[],
    quantity INT NOT NULL,
    sizes TEXT[]
  );
`;

pool.query(createTableQuery)
  .then(() => console.log("Tabela 'products' criada com sucesso ou já existe"))
  .catch(err => console.error("Erro ao criar tabela 'products':", err));

const port = 8000;

// Configura o Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

app.use(cors({
  origin: "*",
  methods: "GET,POST,DELETE,PUT",
  credentials: true,
}));

// Função para deletar imagem do Cloudinary
function deleteImage(publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { invalidate: true }, (error, result) => {
      if (error) {
        console.error("Error deleting image:", error);
        reject(error);
      } else {
        console.log("Image deleted successfully:", result);
        resolve(result);
      }
    });
  });
}

// Upload de imagens para o Cloudinary
app.post("/upload", async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    
    const result = await cloudinary.uploader.upload(file, { folder: "produtos" });
    res.status(200).json({ url: result.secure_url });
  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error);
    res.status(500).json({ error: "Erro ao fazer upload da imagem" });
  }
});

// Listar produtos
app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products");
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// Buscar produto por ID
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (result.rows.length > 0) res.json(result.rows[0]);
    else res.status(404).json({ error: "Produto não encontrado" });
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    res.status(500).json({ error: "Erro ao buscar produto" });
  }
});

// Adicionar novo produto
app.post("/products", async (req, res) => {
  const { title, price, image, category, colors, quantity, sizes } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO products (title, price, image, category, colors, quantity, sizes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [title, price, image, category, colors, quantity, sizes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao adicionar produto:", error);
    res.status(500).json({ error: "Erro ao adicionar produto" });
  }
});

// Atualizar produto
app.put("/products/:id", async (req, res) => {
  const { id } = req.params;
  const { title, price, image, category, colors, quantity, sizes } = req.body;
  try {
    const result = await pool.query(
      "UPDATE products SET title = $1, price = $2, image = $3, category = $4, colors = $5, quantity = $6, sizes = $7 WHERE id = $8 RETURNING *",
      [title, price, image, category, colors, quantity, sizes, id]
    );
    if (result.rows.length > 0) res.json(result.rows[0]);
    else res.status(404).json({ error: "Produto não encontrado" });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: "Erro ao atualizar produto" });
  }
});

// Deletar produto
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT image FROM products WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Produto não encontrado" });
    
    const regex = /produtos\/[^\.]+/;
    const match = result.rows[0].image.match(regex);
    const publicId = match ? match[0] : null;
    if (publicId) await deleteImage(publicId);
    
    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    res.status(200).json({ message: "Produto excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    res.status(500).json({ error: "Erro ao excluir produto" });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
