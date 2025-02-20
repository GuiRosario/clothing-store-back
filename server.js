const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cloudinary = require("cloudinary").v2; // Importa o Cloudinary

const app = express();
const port = 8000;
require("dotenv").config();
// Configura o Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(bodyParser.json({ limit: "10mb" })); // Permite até 10MB
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// Configura o CORS para permitir requisições do frontend
app.use(
  cors({
    origin: "http://localhost:3000", // Permite apenas requisições do frontend
    methods: "GET,POST,DELETE,PUT", // Métodos permitidos
    credentials: true, // Permite cookies e cabeçalhos de autenticação
  })
);

// Middleware para parsear o corpo das requisições
app.use(bodyParser.json());

// Array de produtos (simulando um banco de dados)
let products = [
  {
    id: 1,
    title: "Vestido Longo Farm",
    price: "250",
    image: "/image/vestido.jpg",
    category: "Vestido",
    colors: ["red", "blue", "green"],
    quantity: 3,
    sizes: ["PP", "P", "M"],
  },
  // Outros produtos...
];

// Rota para fazer upload de imagens para o Cloudinary
app.post("/upload", async (req, res) => {
  try {
    const { file } = req.body; // Recebe o arquivo em base64
    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // Faz o upload da imagem para o Cloudinary
    const result = await cloudinary.uploader.upload(file, {
      folder: "produtos", // Pasta no Cloudinary para organizar as imagens
    });

    // Retorna a URL da imagem
    res.status(200).json({ url: result.secure_url });
  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error);
    res.status(500).json({ error: "Erro ao fazer upload da imagem" });
  }
});

// Rota para adicionar um novo produto
app.post("/products", (req, res) => {
  const { title, price, image, category, colors, quantity, sizes } = req.body;

  const newProduct = {
    id: products.length + 1,
    title,
    price,
    image, // URL da imagem do Cloudinary
    category,
    colors,
    quantity: parseInt(quantity, 10),
    sizes,
  };

  products.push(newProduct);
  res.status(201).json(newProduct);
});

// Rota para listar todos os produtos
app.get("/products", (req, res) => {
  res.json(products);
});

// Rota para buscar um produto pelo ID
app.get("/products/:id", (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const product = products.find((p) => p.id === productId);

  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: "Produto não encontrado" });
  }
});

app.delete("/products/:id", async (req, res) => {
  const productId = parseInt(req.params.id, 10);

  // Encontra o índice do produto a ser excluído
  const productIndex = products.findIndex((p) => p.id === productId);

  if (productIndex === -1) {
    return res.status(404).json({ error: "Produto não encontrado" });
  }

  const product = products[productIndex];

  // Extrai o public_id da URL da imagem
  const publicId = product.image.split("/").pop().split(".")[0];

  try {
    // Exclui a imagem do Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Remove o produto do array
    products.splice(productIndex, 1);

    res.status(200).json({ message: "Produto e imagem excluídos com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir a imagem do Cloudinary:", error);
    res.status(500).json({ error: "Erro ao excluir a imagem do Cloudinary" });
  }
});

app.put("/products/:id", (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { title, price, image, category, colors, quantity, sizes } = req.body;

  const productIndex = products.findIndex((p) => p.id === productId);

  if (productIndex === -1) {
    return res.status(404).json({ error: "Produto não encontrado" });
  }

  const updatedProduct = {
    id: productId,
    title,
    price,
    image,
    category,
    colors: colors,
    quantity: parseInt(quantity, 10),
    sizes: sizes,
  };

  products[productIndex] = updatedProduct;
  res.status(200).json(updatedProduct);
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
