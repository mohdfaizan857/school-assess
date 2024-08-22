import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT;

// MySQL Connection Pooling
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.MY_SQL_HOST,
  user: process.env.MY_SQL_USER,
  password: process.env.MY_SQL_PASSWORD,
  database: process.env.MY_SQL_DATABASE,
});

// Middleware to parse JSON bodies
app.use(bodyParser.json());

//Function to calculate distance from latitude and longitudes
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(Math.abs(lat2 - lat1)); // deg2rad below
  var dLon = deg2rad(Math.abs(lon2 - lon1));
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d.toFixed(2);
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Function to validate data types
const validateSchoolData = ({ name, address, latitude, longitude }) => {
  if (typeof name !== "string" || name.trim() === "") {
    return { isValid: false, message: "Invalid name." };
  }
  if (typeof address !== "string" || address.trim() === "") {
    return { isValid: false, message: "Invalid address." };
  }
  if (
    typeof latitude !== "number" ||
    isNaN(latitude) ||
    latitude < -90.0 ||
    latitude > 90.0
  ) {
    return {
      isValid: false,
      message: "Invalid latitude. Must be a number between -90 and 90.",
    };
  }
  if (
    typeof longitude !== "number" ||
    isNaN(longitude) ||
    longitude < -180.0 ||
    longitude > 180.0
  ) {
    return {
      isValid: false,
      message: "Invalid longitude. Must be a number between -180 and 180.",
    };
  }
  return { isValid: true };
};

// Add School API
app.post("/addSchool", (req, res) => {
  const { name, address, latitude, longitude } = req.body;

  // Validate data types
  const validation = validateSchoolData({ name, address, latitude, longitude });
  if (!validation.isValid) {
    return res.status(400).json({ message: validation.message });
  }

  // Insert into database
  const sql =
    "INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)";
  pool.query(sql, [name, address, latitude, longitude], (err, result) => {
    if (err) {
      console.error("Error adding school: ", err);
      return res.status(500).json({
        message: "Failed to add school.",
        err,
      });
    }
    res.status(201).json({ message: "School added successfully." });
  });
});

// List Schools API
app.get("/listSchools", (req, res) => {
  const { latitude, longitude } = req.query;

  // Fetch all schools
  const sql = "SELECT * FROM schools";
  pool.query(sql, (err, schools) => {
    if (err) {
      console.error("Error fetching schools: ", err);
      return res.status(500).json({ message: "Failed to fetch schools." });
    }

    // Calculate distances and sort by proximity
    const sortedSchools = schools
      .map((school) => ({
        ...school,
        distance: getDistanceFromLatLonInKm(
          parseFloat(latitude),
          parseFloat(longitude),
          school.latitude,
          school.longitude
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    res.status(200).json(sortedSchools);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
