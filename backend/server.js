// Load environment variables from root directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (frontend) from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'https://blood-bank-xpby.onrender.com/', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Schemas
const donorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    bloodType: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    lastDonation: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

const inventorySchema = new mongoose.Schema({
    bloodType: { type: String, required: true },
    donorId: { type: String, required: true },
    collectionDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    status: { type: String, default: 'Available', enum: ['Available', 'Used', 'Expired'] },
    createdAt: { type: Date, default: Date.now }
});

const requestSchema = new mongoose.Schema({
    patientName: { type: String, required: true },
    bloodType: { type: String, required: true },
    unitsNeeded: { type: Number, required: true },
    priority: { type: String, required: true, enum: ['Low', 'Medium', 'High', 'Critical'] },
    hospital: { type: String, required: true },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Fulfilled', 'Cancelled'] },
    requestDate: { type: Date, default: Date.now }
});

// Models
const Donor = mongoose.model('Donor', donorSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const Request = mongoose.model('Request', requestSchema);

// API Routes

// Donors
app.get('/api/donors', async (req, res) => {
    try {
        const donors = await Donor.find().sort({ createdAt: -1 });
        res.json(donors);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/donors', async (req, res) => {
    try {
        const donor = new Donor(req.body);
        await donor.save();
        res.json({ success: true, donor });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.delete('/api/donors/:id', async (req, res) => {
    try {
        await Donor.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Donor deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const inventory = await Inventory.find().sort({ createdAt: -1 });
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/inventory', async (req, res) => {
    try {
        const { bloodType, donorId, collectionDate } = req.body;
        
        // Calculate expiry date (35 days from collection for whole blood)
        const expiryDate = new Date(collectionDate);
        expiryDate.setDate(expiryDate.getDate() + 35);
        
        const bloodUnit = new Inventory({
            bloodType,
            donorId,
            collectionDate,
            expiryDate
        });
        
        await bloodUnit.save();
        
        // Update donor's last donation date
        await Donor.findOne({ _id: donorId }).then(donor => {
            if (donor) {
                donor.lastDonation = collectionDate;
                donor.save();
            }
        }).catch(() => {
            // Continue even if donor update fails
        });
        
        res.json({ success: true, bloodUnit });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.delete('/api/inventory/:id', async (req, res) => {
    try {
        await Inventory.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Blood unit deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Requests
app.get('/api/requests', async (req, res) => {
    try {
        const requests = await Request.find().sort({ requestDate: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/requests', async (req, res) => {
    try {
        const request = new Request(req.body);
        await request.save();
        res.json({ success: true, request });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.put('/api/requests/:id', async (req, res) => {
    try {
        const request = await Request.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ success: true, request });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/requests/:id', async (req, res) => {
    try {
        await Request.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Request deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Serve the frontend HTML file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend available at: https://blood-bank-xpby.onrender.com/`);
    console.log(`API available at: https://blood-bank-xpby.onrender.com/`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
