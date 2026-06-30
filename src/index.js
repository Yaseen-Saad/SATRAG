require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require("multer");
const fs = require('fs');
const { log } = require('console');

const app = express();

// Middleware Setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

// CORS Configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.APP_DOMAIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});


app.post('/editscore', async (req, res) => {
  try {
    if (req.body.token !== process.env.ADMIN_REQUEST_TOKEN) {
      return res.status(403).send("Wrong Token");
    }

    const teamRef = db.collection('scores').doc(req.body.id);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      return res.status(404).send({ message: 'Team not found' });
    }

    const teamData = teamDoc.data();
    const updatedScore = teamData.score + Number(req.body.aura);

    await teamRef.update({ score: updatedScore });

    res.status(200).json({ message: "Score updated successfully" });
  } catch (error) {
    console.error('Error updating score:', error);
    res.status(500).json({ message: 'Failed to update scores', error: error.message });
  }
});


app.get('/secretAdminsAuraRoomforEditingScore', async (req, res) => {
  try {
    const scoresSnapshot = await db.collection('scores').get();

    if (scoresSnapshot.empty) {
      return res.status(404).render("detailedScoreboard", { scores: [], message: "No scores found" });
    }

    const scores = scoresSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        questions: Array.isArray(data.questions) ? data.questions : [], // Ensure questions is an array
        score: data.score || 0 // Ensure score is defined
      };
    });

    // Render the detailedScoreboard view with the scores data
    res.render("detailedScoreboard", { scores });
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).send({ message: 'Internal server error', error: error.message });
  }
});


// Login Endpoint
app.get('/scoreboard', async (req, res) => {
  try {
    const response = teams.map(doc => { return { id: doc.id, ...doc } })
    res.render("scoreboard", { scores: response })
  } catch (error) {

  }
});


// Welcome Page
app.get('/', async (req, res) => {
  try {
    res.render("index")
  } catch (error) {
    console.log(error);
  }
});