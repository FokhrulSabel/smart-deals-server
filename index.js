const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// Firebase Admin SDK initialization
const admin = require("firebase-admin");

const serviceAccount = require("./smart-deals-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(express.json());

// Custom middleware for logging
const logger = (req, res, next) => {
  console.log("logging info");
  next();
};

// Custom middleware for verifying Firebase token v2
const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  // verify token
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("after decode token", decoded);
    req.token_email = decoded.email;
    next();
  } catch {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

// Custom middleware for verifying Firebase token
// const verifyFirebaseToken = async (req, res, next) => {
//   console.log("verifying token", req.headers.authorization);
//   // check if authorization header exists
//   if (!req.headers.authorization) {
//     //do not allow to go further
//     return res.status(401).send({ message: "unauthorized access" });
//   }
//   const token = req.headers.authorization.split(" ")[1];
//   if (!token) {
//     return res.status(401).send({ message: "unauthorized access" });
//   }
//   // verify token
//   try {
//     const userInfo = await admin.auth().verifyIdToken(token);
//     req.token_email = userInfo.email;
//     console.log("decoded user info", userInfo);
//     next();
//   } catch {
//     return res.status(401).send({ message: "unauthorized access" });
//   }

//   // next();
// };

// Custom middleware for verifying JWT token
const verifyJWTToken = (req, res, next) => {
  // console.log("verifying JWT token", req.headers);
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    //put it in the right place
    console.log("decoded JWT token", decoded);
    req.token_email = decoded.email;
    next();
  });
};

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@firstdb.egqdlgn.mongodb.net/?appName=firstdb`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("simple smart deals operation server is running");
});

async function run() {
  try {
    await client.connect();
    // Define database and collections
    const db = client.db("smartDealsDB");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");
    const usersCollection = db.collection("users");

    // JWT related api for generating token
    app.post("/getToken", (req, res) => {
      const loggedUser = req.body;
      const token = jwt.sign(loggedUser, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token: token });
    });

    // Users APIs
    app.post("/users", async (req, res) => {
      const newUser = req.body;

      // Check if user already exists
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);
      // If user exists, do not insert again
      if (existingUser) {
        res.send({ message: "User already exists" });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });

    // Products APIs
    // Create Operation - Add a new product
    app.get("/products", async (req, res) => {
      // const projectFields = { title: 1, price_min: 1, price_max: 1, image: 1 }
      // const cursor = productsCollection.find().sort({ price_min: -1 }).skip(2).limit(2).project(projectFields);

      console.log(req.query);
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }

      const cursor = productsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get latest 6 products
    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Read Operation - Get a product by ID
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // Read Operation - Get all products
    app.post("/products", verifyFireBaseToken, async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // Update Operation - Update a product by ID
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedProduct = req.body;
      const updateDoc = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
          // category: updatedProduct.category,
        },
      };

      const result = await productsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Delete Operation - Delete a product by ID
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // Bids APIs with JWT token verification
    // Read Operation - Get all bids, optionally filtered by buyer email
    // app.get("/bids", verifyJWTToken, async (req, res) => {
    //   const email = req.query.email;
    //   const query = {};
    //   if (email) {
    //     query.buyer_email = email;
    //   }

    //   // verify user have access to see this data
    //   if (email !== req.token_email) {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }

    //   const cursor = bidsCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // Bids APIs with firebase token verification
    // Read Operation - Get all bids, optionally filtered by buyer email
    app.get("/bids", verifyFireBaseToken, async (req, res) => {
      // console.log('header',req.headers);
      const email = req.query.email;
      const query = {};
      if (email) {
        query.buyer_email = email;
        if (email !== req.token_email) {
          return res.status(403).send({ message: "forbidden access" });
        }
      }

      const cursor = bidsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get bids for a specific product, sorted by bid price descending
    app.get(
      "/products/bids/:productId",
      verifyFireBaseToken,
      async (req, res) => {
        const productId = req.params.productId;
        const query = { product: productId };
        const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
        const result = await cursor.toArray();
        res.send(result);
      },
    );

    // Duplicate route removed
    // app.get("/bids", async (req, res) => {
    //   const query = {};
    //   if (query.email) {
    //     query.buyer_email = email;
    //   }

    //   const cursor = bidsCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // Create Operation - Add a new bid
    app.post("/bids", async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    // Delete Operation - Delete a bid by ID
    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`simple curd operation server is running on port: ${port}`);
});
