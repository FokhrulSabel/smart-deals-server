const express = require("express");
const cors = require("cors");

const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection URI
const uri = "mongodb+srv://simpleDBUser:<db_password>@firstdb.egqdlgn.mongodb.net/?appName=firstdb";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("simple curd operation server is running");
});


async function run() {
    try{

        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }finally{
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`simple curd operation server is running on port: ${port}`);
});
