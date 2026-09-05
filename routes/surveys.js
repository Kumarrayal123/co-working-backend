const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Survey = require('../model/Survey');

// Create a new survey
router.post('/submitsurvey', async (req, res) => {
  try {
    const { 
      title, 
      description, 
      questions, 
      noOfTables,
      spaceName,
      spaceType,
      mobileNumber,
      address,
      submittedBy
    } = req.body;

    console.log('📝 Received survey data:', JSON.stringify(req.body, null, 2));

    if (!title) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title is required' 
      });
    }

    // Validate mobile number
    const mobileRegex = /^[0-9]{10}$/;
    if (mobileNumber && !mobileRegex.test(mobileNumber.replace(/[^0-9]/g, ''))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 10-digit mobile number' 
      });
    }

    // Validate noOfTables if cafe
    if (spaceType === 'cafe') {
      if (!noOfTables || parseInt(noOfTables) <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Number of tables is required for cafes' 
        });
      }
    }

    // Format questions to match QuestionSchema
    let formattedQuestions = [];
    if (Array.isArray(questions)) {
      formattedQuestions = questions.map(q => {
        if (typeof q === 'string') {
          return { text: q, type: 'text' };
        }
        return { text: q.text || '', type: q.type || 'text' };
      });
    }

    const survey = new Survey({
      title,
      description: description || '',
      questions: formattedQuestions,
      noOfTables: noOfTables || null,
      spaceName: spaceName || title,
      spaceType: spaceType || 'co-working',
      mobileNumber: mobileNumber || '',
      address: address || '',
      submittedBy: submittedBy || 'Anonymous'
    });

    await survey.save();

    console.log('✅ Survey saved successfully:', survey._id);

    res.status(201).json({ 
      success: true, 
      message: 'Survey submitted successfully',
      survey 
    });

  } catch (err) {
    console.error('❌ Create survey error:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        error: errors.join(', ') 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Get all surveys (optionally with pagination)
router.get('/allsurveys', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const surveys = await Survey.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Survey.countDocuments();
    res.json({ success: true, surveys, pagination: { total, page, limit } });
  } catch (err) {
    console.error('List surveys error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// Get a single survey by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const survey = await Survey.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }
    res.json({ success: true, survey });
  } catch (err) {
    console.error('Get survey error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a survey (without auth)
router.put('/updatesurvey/:id', async (req, res) => {
  try {
    const updates = {};
    const allowed = ['title', 'description', 'questions', 'noOfTables'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const survey = await Survey.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    
    if (!survey) {
      return res.status(404).json({ success: false, message: 'Survey not found' });
    }
    res.json({ success: true, survey });
  } catch (err) {
    console.error('Update survey error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a survey (without auth)
router.delete('/:id', async (req, res) => {
  try {
    const survey = await Survey.findByIdAndDelete(req.params.id);
    if (!survey) {
      return res.status(404).json({ success: false, message: 'Survey not found' });
    }
    res.json({ success: true, message: 'Survey deleted' });
  } catch (err) {
    console.error('Delete survey error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});



module.exports = router;