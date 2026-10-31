const express = require('express');
const router = express.Router();
const { getAllUsers, getUserDeepDetails, updateUserRole, deleteUser } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication and the 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/users', getAllUsers);
router.get('/users/:id', getUserDeepDetails);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

module.exports = router;

