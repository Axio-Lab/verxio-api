import { Router, Request, Response, NextFunction } from 'express';
import * as loyaltyService from '../services/loyaltyService';

export const loyaltyRouter: Router = Router();

/**
 * @swagger
 * /loyalty/program/create:
 *   post:
 *     summary: Create whitelabel loyalty program 
 *     tags: [Loyalty Programs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creatorEmail
 *               - loyaltyProgramName
 *               - imageURL
 *               - metadata
 *               - tiers
 *               - pointsPerAction
 *             properties:
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *                 example: creator@example.com
 *               loyaltyProgramName:
 *                 type: string
 *                 example: "Acme Rewards"
 *               imageURL:
 *                 type: string
 *                 format: uri
 *                 description: Required. Image URL used to automatically generate metadata. The generated metadataUri will be stored in the program for reuse when issuing loyalty passes.
 *                 example: "https://gateway.pinata.cloud/ipfs/Qm..."
 *               metadataUri:
 *                 type: string
 *                 format: uri
 *                 description: Optional. If provided, this will be used instead of auto-generating from imageURL. If not provided, metadata will be automatically generated from imageURL and stored.
 *                 example: "https://example.com/loyalty/metadata.json"
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the loyalty program
 *                 properties:
 *                   organizationName:
 *                     type: string
 *                     example: "Acme Inc."
 *                   brandColor:
 *                     type: string
 *                     example: "#FF5733"
 *               tiers:
 *                 type: array
 *                 description: Loyalty tiers configuration
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Gold"
 *                     xpRequired:
 *                       type: number
 *                       example: 1000
 *                     rewards:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["10% discount", "Free shipping"]
 *               pointsPerAction:
 *                 type: object
 *                 description: Mapping of user actions to loyalty points
 *                 additionalProperties:
 *                   type: number
 *                 example:
 *                   purchase: 10
 *                   review: 20
 *                   referral: 50
 *           examples:
 *             example1:
 *               summary: Create loyalty program with imageURL (auto-generates metadata)
 *               value:
 *                 creatorEmail: "creator@example.com"
 *                 loyaltyProgramName: "Acme Rewards"
 *                 imageURL: "https://gateway.pinata.cloud/ipfs/Qm..."
 *                 metadata:
 *                   organizationName: "Acme Inc."
 *                   brandColor: "#FF5733"
 *                 tiers:
 *                   - name: "Bronze"
 *                     xpRequired: 0
 *                     rewards: ["Welcome bonus"]
 *                   - name: "Silver"
 *                     xpRequired: 500
 *                     rewards: ["5% discount"]
 *                   - name: "Gold"
 *                     xpRequired: 1000
 *                     rewards: ["10% discount", "Free shipping"]
 *                 pointsPerAction:
 *                   purchase: 10
 *                   review: 20
 *                   referral: 50
 *             example2:
 *               summary: Create loyalty program with custom metadataUri
 *               value:
 *                 creatorEmail: "creator@example.com"
 *                 loyaltyProgramName: "Acme Rewards"
 *                 imageURL: "https://gateway.pinata.cloud/ipfs/Qm..."
 *                 metadataUri: "https://example.com/loyalty/metadata.json"
 *                 metadata:
 *                   organizationName: "Acme Inc."
 *                   brandColor: "#FF5733"
 *                 tiers:
 *                   - name: "Bronze"
 *                     xpRequired: 0
 *                     rewards: ["Welcome bonus"]
 *                   - name: "Silver"
 *                     xpRequired: 500
 *                     rewards: ["5% discount"]
 *                   - name: "Gold"
 *                     xpRequired: 1000
 *                     rewards: ["10% discount", "Free shipping"]
 *                 pointsPerAction:
 *                   purchase: 10
 *                   review: 20
 *                   referral: 50
 *     responses:
 *       201:
 *         description: Loyalty program created successfully
 */
loyaltyRouter.post('/program/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Map imageURL from request to imageUri for service
    const body = { ...req.body };
    if (body.imageURL) {
      body.imageUri = body.imageURL;
      delete body.imageURL;
    }
    const result = await loyaltyService.createLoyaltyProgram(body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/pass/issue:
 *   post:
 *     summary: Issue new loyalty pass
 *     tags: [Loyalty Programs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loyaltyProgramAddress
 *               - recipientEmail
 *               - passName
 *               - organizationName
 *               - authorityEmail
 *             properties:
 *               loyaltyProgramAddress:
 *                 type: string
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 example: recipient@example.com
 *               passName:
 *                 type: string
 *               organizationName:
 *                 type: string
 *                 example: "Acme Inc."
 *               authorityEmail:
 *                 type: string
 *                 format: email
 *                 example: authority@example.com
 *                 description: Email address of the authority (must be a registered Verxio user)
 *           examples:
 *             example1:
 *               summary: Issue loyalty pass (uses program's stored metadata URI)
 *               value:
 *                 loyaltyProgramAddress: "47NBxANSYPxxCRr1EFcCa3TxrULef2P1ThH3V6ssw1P2"
 *                 recipientEmail: "recipient@example.com"
 *                 passName: "Gold Member Pass"
 *                 organizationName: "Acme Inc."
 *                 authorityEmail: "authority@example.com"
 *     responses:
 *       201:
 *         description: Loyalty pass issued successfully
 */
loyaltyRouter.post('/pass/issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.issueLoyaltyPassBlockchain(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/points/gift:
 *   post:
 *     summary: Gift loyalty points to a pass
 *     tags: [Loyalty Programs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passAddress
 *               - pointsToGift
 *               - action
 *               - collectionAddress
 *               - authorityEmail
 *             properties:
 *               passAddress:
 *                 type: string
 *               pointsToGift:
 *                 type: number
 *               action:
 *                 type: string
 *               collectionAddress:
 *                 type: string
 *               authorityEmail:
 *                 type: string
 *                 format: email
 *                 example: authority@example.com
 *     responses:
 *       200:
 *         description: Points gifted successfully
 */
loyaltyRouter.post('/points/gift', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.giftLoyaltyPointsBlockchain(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/points/revoke:
 *   post:
 *     summary: Revoke loyalty points from a pass
 *     tags: [Loyalty Programs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passAddress
 *               - pointsToRevoke
 *               - collectionAddress
 *               - authorityEmail
 *             properties:
 *               passAddress:
 *                 type: string
 *               pointsToRevoke:
 *                 type: number
 *               collectionAddress:
 *                 type: string
 *               authorityEmail:
 *                 type: string
 *                 format: email
 *                 example: authority@example.com
 *     responses:
 *       200:
 *         description: Points revoked successfully
 */
loyaltyRouter.post('/points/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.revokeLoyaltyPointsBlockchain(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});


/**
 * @swagger
 * /loyalty/programs/{creatorEmail}:
 *   get:
 *     summary: Get all loyalty programs for a creator
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: creatorEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Creator email address
 *     responses:
 *       200:
 *         description: List of loyalty programs
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.get('/programs/:creatorEmail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorEmail } = req.params;
    const result = await loyaltyService.getUserLoyaltyPrograms(creatorEmail);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/details:
 *   get:
 *     summary: Get loyalty program details
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: query
 *         name: creatorEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Creator email address
 *       - in: query
 *         name: programPublicKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Program public key
 *     responses:
 *       200:
 *         description: Program details retrieved successfully
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.get('/program/details', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorEmail, programPublicKey } = req.query;
    const result = await loyaltyService.getLoyaltyProgramDetails({
      creatorEmail: creatorEmail as string,
      programPublicKey: programPublicKey as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/authority/{collectionAddress}:
 *   get:
 *     summary: Get collection authority secret key
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: collectionAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Collection address
 *     responses:
 *       200:
 *         description: Authority keys retrieved successfully
 *       404:
 *         description: Loyalty program not found
 */
loyaltyRouter.get('/program/authority/:collectionAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionAddress } = req.params;
    const result = await loyaltyService.getCollectionAuthoritySecretKey(collectionAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/users/{collectionAddress}:
 *   get:
 *     summary: Get loyalty program users from
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: collectionAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Collection address
 *     responses:
 *       200:
 *         description: Program users retrieved successfully
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.get('/program/users/:collectionAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionAddress } = req.params;
    const result = await loyaltyService.getLoyaltyProgramUsers(collectionAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/members/total:
 *   post:
 *     summary: Get total members across multiple programs
 *     tags: [Loyalty Programs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - programAddresses
 *             properties:
 *               programAddresses:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["address1", "address2"]
 *     responses:
 *       200:
 *         description: Total members count retrieved successfully
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.post('/program/members/total', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.getTotalMembersAcrossPrograms(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/passes/{userEmail}:
 *   get:
 *     summary: Get user loyalty passes
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: userEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *     responses:
 *       200:
 *         description: User loyalty passes retrieved successfully
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.get('/passes/:userEmail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userEmail } = req.params;
    const result = await loyaltyService.getUserLoyaltyPasses(userEmail);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/membership:
 *   get:
 *     summary: Check user loyalty program membership
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: query
 *         name: userEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *       - in: query
 *         name: loyaltyProgramAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Loyalty program address
 *     responses:
 *       200:
 *         description: Membership status retrieved successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Loyalty program not found
 */
loyaltyRouter.get('/program/membership', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userEmail, loyaltyProgramAddress } = req.query;
    const result = await loyaltyService.checkUserLoyaltyProgramMembership({
      userEmail: userEmail as string,
      loyaltyProgramAddress: loyaltyProgramAddress as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/{programAddress}:
 *   get:
 *     summary: Get loyalty program by address
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: programAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Program address
 *     responses:
 *       200:
 *         description: Program details retrieved successfully
 *       404:
 *         description: Loyalty program not found
 */
loyaltyRouter.get('/program/:programAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { programAddress } = req.params;
    const result = await loyaltyService.getLoyaltyProgramByAddress(programAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/claim-status/{programAddress}:
 *   get:
 *     summary: Get claim status for a loyalty program
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: programAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Program address
 *     responses:
 *       200:
 *         description: Claim status retrieved successfully
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.get('/program/claim-status/:programAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { programAddress } = req.params;
    const result = await loyaltyService.getClaimStatus(programAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/pass/{passAddress}:
 *   get:
 *     summary: Get loyalty pass details
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: passAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Pass address
 *     responses:
 *       200:
 *         description: Pass details retrieved successfully
 *       404:
 *         description: Loyalty pass not found
 */
loyaltyRouter.get('/pass/:passAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passAddress } = req.params;
    const result = await loyaltyService.getLoyaltyPassDetails(passAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/program/claim-status/{programAddress}:
 *   put:
 *     summary: Toggle claim enabled status
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: programAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Program address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Claim status updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Loyalty program not found
 */
loyaltyRouter.put('/program/claim-status/:programAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { programAddress } = req.params;
    const { enabled } = req.body;
    const result = await loyaltyService.toggleClaimEnabled({
      programAddress,
      enabled,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/claim-link/create:
 *   post:
 *     summary: Create a single claim link for a loyalty pass
 *     tags: [Loyalty Programs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - programAddress
 *               - passName
 *               - authorityEmail
 *             properties:
 *               programAddress:
 *                 type: string
 *                 example: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1EH..."
 *                 description: Public key address of the loyalty program
 *               passName:
 *                 type: string
 *                 example: "Gold Member Pass"
 *               organizationName:
 *                 type: string
 *                 example: "Acme Inc."
 *               description:
 *                 type: string
 *                 example: "Claim your loyalty pass"
 *               authorityEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *                 description: Email address of the authority (must be a registered Verxio user)
 *           examples:
 *             example1:
 *               summary: Create loyalty claim link
 *               value:
 *                 programAddress: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1....."
 *                 passName: "Gold Member Pass"
 *                 organizationName: "Acme Inc."
 *                 description: "Claim your loyalty pass"
 *                 authorityEmail: "merchant@example.com"
 *     responses:
 *       201:
 *         description: Claim link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 claimCode:
 *                   type: string
 *                   example: "abc123xyz"
 *                   description: The claim code that can be used to claim the loyalty pass
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.post('/claim-link/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.createLoyaltyClaimLink(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/claim-link/create/batch:
 *   post:
 *     summary: Create multiple claim links for loyalty passes in batch
 *     tags: [Loyalty Programs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - programAddress
 *               - passName
 *               - authorityEmail
 *               - quantity
 *             properties:
 *               programAddress:
 *                 type: string
 *                 example: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1EH..."
 *               passName:
 *                 type: string
 *                 example: "Gold Member Pass"
 *               organizationName:
 *                 type: string
 *                 example: "Acme Inc."
 *               description:
 *                 type: string
 *                 example: "Claim your loyalty pass"
 *               authorityEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *               quantity:
 *                 type: integer
 *                 example: 20
 *                 description: Number of claim links to create (minimum 1, no maximum limit)
 *           examples:
 *             example1:
 *               summary: Create 20 loyalty claim links
 *               value:
 *                 programAddress: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1....."
 *                 passName: "Gold Member Pass"
 *                 organizationName: "Acme Inc."
 *                 description: "Claim your loyalty pass"
 *                 authorityEmail: "merchant@example.com"
 *                 quantity: 20
 *     responses:
 *       201:
 *         description: Claim links created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 claimCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["abc123xyz", "def456uvw", "ghi789rst"]
 *                   description: Array of claim codes
 *                 message:
 *                   type: string
 *                   example: "Successfully created 20 claim links"
 *       400:
 *         description: Invalid input
 */
loyaltyRouter.post('/claim-link/create/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.createBatchLoyaltyClaimLinks(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/claim-link/{claimCode}:
 *   get:
 *     summary: Get loyalty claim link details
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: claimCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Claim code returned during creation
 *     responses:
 *       200:
 *         description: Claim link fetched successfully
 *       404:
 *         description: Claim link not found
 */
loyaltyRouter.get('/claim-link/:claimCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.getLoyaltyClaimLink(req.params.claimCode);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /loyalty/claim-link/{claimCode}/claim:
 *   post:
 *     summary: Claim a loyalty pass using a claim link
 *     tags: [Loyalty Programs]
 *     parameters:
 *       - in: path
 *         name: claimCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Claim code returned during creation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientEmail
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 example: "customer@example.com"
 *     responses:
 *       200:
 *         description: Loyalty pass issued successfully from claim link
 *       400:
 *         description: Invalid input or claim link already used/expired
 */
loyaltyRouter.post('/claim-link/:claimCode/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { claimCode } = req.params;
    const { recipientEmail } = req.body;
    const result = await loyaltyService.claimLoyaltyPassFromLink(claimCode, recipientEmail);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

