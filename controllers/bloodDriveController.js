import BloodDrive from '../models/BloodDrive.js';
import User from '../models/User.js';
import Donation from '../models/Donation.js';

export const createBloodDrive = async (req, res) => {
  try {
    const bloodDrive = await BloodDrive.create({
      ...req.body,
      organizer: req.user._id
    });

    // Notify via socket
    const io = req.app.get('io');
    io.emit('new-blood-drive', {
      drive: bloodDrive,
      message: `New blood drive: ${bloodDrive.name}`
    });

    res.status(201).json({
      success: true,
      data: bloodDrive
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const joinBloodDrive = async (req, res) => {
  try {
    const { driveId } = req.params;
    const { teamId } = req.body;

    const bloodDrive = await BloodDrive.findById(driveId);
    
    if (!bloodDrive) {
      return res.status(404).json({
        success: false,
        message: 'Blood drive not found'
      });
    }

    // Check if already participant
    const isParticipant = bloodDrive.participants.some(
      p => p.user.toString() === req.user._id.toString()
    );

    if (isParticipant) {
      return res.status(400).json({
        success: false,
        message: 'Already participating in this drive'
      });
    }

    // Add participant
    bloodDrive.participants.push({
      user: req.user._id,
      joinedAt: new Date()
    });

    // Add to team if specified
    if (teamId) {
      const team = bloodDrive.teams.id(teamId);
      if (team) {
        team.members.push(req.user._id);
      }
    }

    await bloodDrive.save();

    // Real-time update
    const io = req.app.get('io');
    io.emit('drive-update', {
      driveId,
      type: 'new-participant',
      participant: req.user.name
    });

    res.json({
      success: true,
      message: 'Successfully joined blood drive'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getActiveBloodDrives = async (req, res) => {
  try {
    const now = new Date();
    const drives = await BloodDrive.find({
      status: 'active',
      endDate: { $gte: now },
      isPublic: true
    })
    .populate('organizer', 'name')
    .sort('-createdAt');

    res.json({
      success: true,
      data: drives
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getBloodDriveLeaderboard = async (req, res) => {
  try {
    const { driveId } = req.params;
    
    const bloodDrive = await BloodDrive.findById(driveId)
      .populate('participants.user', 'name bloodType profileImage')
      .populate('teams.members', 'name');

    if (!bloodDrive) {
      return res.status(404).json({
        success: false,
        message: 'Blood drive not found'
      });
    }

    // Sort participants by donation status and units
    const leaderboard = bloodDrive.participants
      .filter(p => p.donated)
      .sort((a, b) => b.units - a.units)
      .map((p, index) => ({
        rank: index + 1,
        user: p.user,
        units: p.units,
        donatedAt: p.donatedAt
      }));

    // Team leaderboard
    const teamLeaderboard = bloodDrive.teams
      .sort((a, b) => b.progress - a.progress)
      .map((team, index) => ({
        rank: index + 1,
        name: team.name,
        progress: team.progress,
        goal: team.goal,
        members: team.members.length
      }));

    res.json({
      success: true,
      data: {
        individual: leaderboard,
        teams: teamLeaderboard,
        overall: {
          progress: bloodDrive.progress,
          goal: bloodDrive.goal
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateDonationStatus = async (req, res) => {
  try {
    const { driveId, userId } = req.params;
    const { units } = req.body;

    const bloodDrive = await BloodDrive.findById(driveId);
    
    const participant = bloodDrive.participants.find(
      p => p.user.toString() === userId
    );

    if (participant) {
      participant.donated = true;
      participant.donatedAt = new Date();
      participant.units = units;

      // Update progress
      bloodDrive.progress.donors += 1;
      bloodDrive.progress.units += units;
      bloodDrive.statistics.totalDonors += 1;
      bloodDrive.statistics.totalUnits += units;
      bloodDrive.statistics.livesSaved = bloodDrive.statistics.totalUnits * 3;

      await bloodDrive.save();

      // Real-time update
      const io = req.app.get('io');
      io.emit('drive-progress', {
        driveId,
        progress: bloodDrive.progress
      });
    }

    res.json({
      success: true,
      message: 'Donation status updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const shareOnSocial = async (req, res) => {
  try {
    const { driveId } = req.params;
    const { platform } = req.body;

    const bloodDrive = await BloodDrive.findById(driveId);
    
    const shareText = `I'm participating in ${bloodDrive.name}! We've collected ${bloodDrive.progress.units} units and saved ${bloodDrive.statistics.livesSaved} lives. Join us!`;
    const shareUrl = `${process.env.CLIENT_URL}/blood-drive/${bloodDrive.shareCode}`;

    const shareLinks = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`
    };

    res.json({
      success: true,
      shareLink: shareLinks[platform] || shareLinks.twitter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
