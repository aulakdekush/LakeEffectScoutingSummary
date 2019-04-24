/*jshint esversion: 6 */

const fs = require("fs");
const summarizer = require("./summarizer");

var express = require('express');
var https = require('https');
var http = require('http');

//https://stackoverflow.com/a/14272874/1985387
var options = {
  key: fs.readFileSync('./certificates/private.key'),
  cert: fs.readFileSync('./certificates/certificate.crt')
};

// Create a service (the app object is just a callback).
var app = express();

// Create an HTTP service.
http.createServer(app).listen(80);
// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(443);

//add the public files
app.get('/', function (req, res) {
    return res.sendFile("index.html", { root: __dirname });
});

app.get('/styles.css', function (req, res) {
    return res.sendFile("styles.css", { root: __dirname });
});

app.get('/index.js', function (req, res) {
    return res.sendFile("index.js", { root: __dirname });
});

//publish photos
app.use('/photos', express.static(__dirname + '/photos'));

//list that holds all the data for the robots
var robots = [];
//the labels at the top of each file, only pulled once
var labels = null;

//last match updated on
var lastUpdated = -1;

//setup replace all function https://stackoverflow.com/a/38015918/1985387
String.prototype.replaceAll = function(search, replace) {
    if (replace === undefined) {
        return this.toString();
    }
    return this.split(search).join(replace);
}

function loadData() {
    fs.readdir('./data', function (err, items) {
        if (err) throw err;

        //iterate through all files
        for (let i = 0; i < items.length; i++) {
            fs.readFile('./data/' + items[i], "utf8", function (error, data) {
                if (error) throw error;
                if (data === "") {
                    //file is empty
                    return;
                }

                //parse through the data
                if (labels === null) {
                    labels = data.split("\n")[0].split(",");
                }

                let robot = new Robot();
                robot.robotNumber = items[i].replace(".csv", "");

                let lines = data.split("\n");

                let robotData = [];

                for (let s = 0; s < lines.length; s++) {
                    robotData.push(lines[s].split(","));

                    //find match number
                    if (s > 0) {
                        //update last updated to be the latest match number scouted
                        if (parseInt(lines[s].split(",")[0]) > lastUpdated) {
                            lastUpdated = parseInt(lines[s].split(",")[0]);
                        }
                    }
                }

                //sort robotData by match number
                //start it with the labels, they should always be at the top
                let robotDataSorted = [robotData[0]];

                //start at 1 to ignore labels at the top of the csv file
                for (let s = 1; s < robotData.length; s++) {
                    for (let q = 1; q < robotData.length; q++) {
                        //skip over if already dealt with
                        if (robotDataSorted.includes(robotData[q])) continue;

                        if (robotDataSorted.length == s) {
                            //start it with a default number
                            robotDataSorted.push([-1]);
                        }

                        if (robotDataSorted[s][0] === -1 || parseInt(robotData[q][0]) < parseInt(robotDataSorted[s][0])) {
                            //this one is the lower one, it should be here (sorting from lowest to highest)
                            robotDataSorted[s] = robotData[q];
                        }
                    }
                }

                robot.data = robotDataSorted;

                //add to the full list of robots
                robots.push(robot);
            });
        }
    });

}
loadData();

//creates the robot preview data that will be sent to the client
//calls back with the data
app.get('/createOverallSummary', function (req, res) {
    summarizer.generateAllStats(labels, robots);

    let result = summarizer.getOverallData(req.query.robotNumber, labels, robots);

    res.send(result);
});
app.get('/createAutoSummary', function (req, res) {
    let result = summarizer.getAutoSummary(req.query.robotNumber, labels, robots);

    res.send(result);
});
app.get('/createPreMatchSummary', function (req, res) {
    let result = summarizer.getPreMatchSummary(req.query.robotNumber, labels, robots);

    res.send(result);
});
app.get('/createCommentsSummary', function (req, res) {
    let result = summarizer.getCommentsSummary(req.query.robotNumber, labels, robots);

    res.send(result);
});
app.get('/getLastUpdated', function (req, res) {
    res.send({lastUpdated}).end();
});

app.get('/getLabels', function (req, res) {
    res.send(labels);

    summarizer.generateAllStats(labels, robots);
});

//gets data under a specific label
app.get('/getDataForLabel', function (req, res) {
    let data = summarizer.getDataForLabel(req.query.robotNumber, labels, robots, req.query.searchTerm.toLowerCase());

    res.send({
                label: req.query.searchTerm, 
                result: data
            });
});

//Classes
class Robot {
    constructor(robotNumber, data) {
        this.robotNumber = robotNumber;
        this.data = data;
    }
}