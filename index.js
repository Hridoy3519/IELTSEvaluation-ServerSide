const express = require("express");
const { MongoClient, ServerApiVersion } = require('mongodb');
const { Configuration, OpenAIApi } = require("openai");
const ObjectId = require("mongodb").ObjectId;
require('dotenv').config()
const cors = require("cors")
const app = express();

app.use(express.json());
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.voagd.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect()
        console.log("Database Connected Successfully");
        const database = client.db('ieltsEvaluation');
        const testCollections = database.collection("exams");
        const reviewCollections = database.collection("reviews");
        const userCollections = database.collection("users");

        //API TO SAVE USER ON MONGODB
        app.post("/users", async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await userCollections.insertOne(user);
            res.json(result);
        });

        //API TO UPDATE EXISTING USER
        app.put("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollections.updateOne(query, updateDoc, options);
            res.json(result);
        });

        //POST API TO ADD NEW TEST RESULT
        app.post("/addNewTest", async (req, res) => {
            const test = req.body;
            console.log(test);
            const result = await testCollections.insertOne(test);
            res.json(result);
        });

        //API TO GET ALL THE TESTS OF A USER
        app.post("/tests/user", async (req, res) => {
            const userEmail = req.body.email;
            const query = { user: userEmail };
            const tests = await testCollections.find(query).toArray();
            console.log(userEmail)
            console.log(tests)
            res.json(tests);
        });

        //API TO GET DETAILS OF A SINGLE TESTS
        app.get("/tests/:id", async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) };
            const test = await testCollections.findOne(query);
            res.send(test);
        });
    }
    finally {
        //await client.close()
    }
}

run().catch(console.dir);

const get_from_davinci_model = async (
    prompt,
    { max_tokens = 100, temperature = 0.7 } = {}
) => {
    // const OPENAI_API_KEY = "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";
    const OPENAI_API_KEY = "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";

    const configuration = new Configuration({
        apiKey: OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        temperature: temperature,
        max_tokens: max_tokens,
        top_p: 1,
        n: 1,
    });

    data = {
        status: 200,
        message: "Request was successful.",
        data: response?.data?.choices[0].text.trim(), //generatedText
        model: response?.data?.model,
        others: {
            ...response?.data?.usage,
            cost: (response?.data?.usage?.total_tokens * 0.02) / 10,
        },
    };
    return data;
};

app.get("/test-questions", async (req, res) => {
    try {
        // Prompt for the GPT-3 model
        const prompt = `Generate a proper random question for IELTS writing test task 2 with general context, not for any perticular group of pepole
    Question : Many people say that globalisation and the growing number of multinational companies have a negative effect on the environment. To what extent do you agree or disagree? Use specific reasons and examples to support your position
    Question : Nowadays both men and women spend a lot of money on beauty care. This was not so in the past. What may be the root cause of this behaviour? Discuss the reasons and possible results
    Question :`;

        // Pass the promt to this function to get the answer
        data = await get_from_davinci_model(prompt, {
            max_tokens: 200,
            temperature: 1
        });

        res.status(200).json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json("Server Error");
    }
});

app.post("/test-answer", async (req, res) => {
    try {
        const { question } = req.body;

        // Prompt for the GPT-3 model
        const prompt = `Please provide a well-structured and insightful response to the following IELTS writing test task 2 question with minimum 250 word to maximum 300 words
    Question : ${question}
    Answer :`;

        // Pass the promt to this function to get the answer
        data = await get_from_davinci_model(prompt, {
            max_tokens: 400,
        });

        res.status(200).json({ ...data, question: question });
    } catch (error) {
        console.error(error);
        res.status(500).json("Server Error");
    }
});

app.post("/test-band-score", async (req, res) => {
    try {
        const { question, answer } = req.body;
        console.log("Question", question)
        console.log("ANswer", answer)
        // Prompt for the GPT-3 model
        const prompt = `Act as a certified IELTS examiner and evaluate the bellow essay based on the IELTS assessment criteria for writing task 1. Give suggestion to improve the essay.
        Question: "${question}"
        Essay: "${answer}"
        Band Score:`;

        // Pass the promt to this function to get the answer
        data = await get_from_davinci_model(prompt, {
            max_tokens: 400,
            temperature: 0
        });

        band_score = data?.data[0];

        const feedback = data?.data?.substring(3);

        res
            .status(200)
            .json({ band_score, feedback, ...data, question: question, answer });
    } catch (error) {
        console.error(error);
        res.status(500).json("Server Error");
    }
});

//

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
