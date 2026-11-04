const router = require('express').Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const Story = require('../models/StudentStory');
const run = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const valid = (req,res,next) => { const errors=validationResult(req); if(!errors.isEmpty())return res.status(400).json({success:false,error:errors.array()[0].msg}); next(); };
router.get('/',run(async(req,res)=>res.json({success:true,data:await require('../services/studentStories').publishedStories()})));
router.use(verifyToken);
router.get('/mine',requireRole('student'),run(async(req,res)=>res.json({success:true,data:await Story.findOne({userId:req.user.userId})})));
router.put('/mine',requireRole('student'),body('displayName').isString().trim().isLength({min:1,max:60}),body('message').isString().trim().isLength({min:20,max:700}),body('consent').custom(v=>v===true).withMessage('Agree to display your chosen name and message publicly before submitting.'),valid,run(async(req,res)=>{
  const data=await Story.findOneAndUpdate({userId:req.user.userId},{$set:{displayName:req.body.displayName,message:req.body.message,consent:true,status:'pending',moderationNote:''},$inc:{revision:1}},{upsert:true,new:true,runValidators:true});
  res.json({success:true,data});
}));
router.delete('/mine',requireRole('student'),run(async(req,res)=>{await Story.deleteOne({userId:req.user.userId});res.json({success:true});}));
router.get('/staff',requireRole('admin'),run(async(req,res)=>res.json({success:true,data:await Story.find().sort('-updatedAt').limit(100).populate('userId','name email')})));
router.patch('/staff/:id',requireRole('admin'),body('status').isIn(['published','hidden']),body('revision').isInt({min:1}),body('moderationNote').optional().isString().trim().isLength({max:400}),valid,run(async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({success:false,error:'Invalid story.'});
  const data=await Story.findOneAndUpdate({_id:req.params.id,revision:req.body.revision,consent:true},{$set:{status:req.body.status,moderationNote:req.body.moderationNote||''}},{new:true});
  if(!data)return res.status(409).json({success:false,error:'This message changed or was withdrawn. Refresh and review it again.'});
  res.json({success:true,data});
}));
module.exports=router;
