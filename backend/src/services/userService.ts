import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner } from '@metaplex-foundation/umi';
import { uint8ArrayToBase58String } from '../lib/utils';

const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;

export interface CreateUserData {
  email: string;
}


export interface IssueVerxioData {
  email: string;
  amount: number;
  description?: string;
}

export interface TransferVerxioData {
  fromEmail: string;
  toEmail: string;
  amount: number;
  description?: string;
}

export const createUser = async (data: CreateUserData) => {
  const { email } = data;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Invalid email format', 400);
  }

  // Check if user already exists
  const existingUser = await prisma.verxioUser.findFirst({
    where: { email },
  });

  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  // Generate signer for the user
  const umi = createUmi(RPC_ENDPOINT);
  const signer = generateSigner(umi);
  
  // Extract public key and convert secret key to base58 string
  const creatorAddress = signer.publicKey.toString();
  const creatorPrivateKey = uint8ArrayToBase58String(signer.secretKey);

  // Create user with initial 1000 Verxio balance
  const INITIAL_VERXIO_BALANCE = 1000;
  
  const user = await prisma.verxioUser.create({
    data: {
      email,
      verxioBalance: INITIAL_VERXIO_BALANCE,
      creatorAddress,
      creatorPrivateKey,
    },
    select: {
      id: true,
      email: true,
      verxioBalance: true,
      creatorAddress: true,
      creatorPrivateKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Create transaction record for initial credit
  await prisma.verxioTransaction.create({
    data: {
      fromUserId: null, // System/admin issued
      toUserId: user.id,
      amount: INITIAL_VERXIO_BALANCE,
      description: `Welcome bonus: ${INITIAL_VERXIO_BALANCE} Verxio credits`,
    },
  });

  return { success: true, user };
};

export const getUserByEmail = async (email: string) => {
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const user = await prisma.verxioUser.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      verxioBalance: true,
      creatorAddress: true,
      creatorPrivateKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return { success: true, user };
};


export const deleteUser = async (email: string) => {
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  // Check if user exists
  const existingUser = await prisma.verxioUser.findFirst({
    where: { email },
  });

  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  // Delete related transactions first to avoid foreign key constraint
  await prisma.verxioTransaction.deleteMany({
    where: {
      OR: [
        { fromUserId: existingUser.id },
        { toUserId: existingUser.id },
      ],
    },
  });

  // Delete user (API keys will be cascade deleted)
  await prisma.verxioUser.delete({
    where: { id: existingUser.id },
  });

  return { success: true, message: 'User deleted successfully' };
};

/**
 * Get user creator address and private key by email
 */
export const getUserCreatorInfo = async (email: string) => {
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const user = await (prisma as any).verxioUser.findFirst({
    where: { email },
    select: {
      creatorAddress: true,
      creatorPrivateKey: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.creatorAddress || !user.creatorPrivateKey) {
    throw new AppError('User creator address and private key not found', 404);
  }

  return {
    creatorAddress: user.creatorAddress,
    creatorPrivateKey: user.creatorPrivateKey,
  };
};

/**
 * Get user email by creator address
 */
export const getUserEmailByCreatorAddress = async (creatorAddress: string) => {
  if (!creatorAddress) {
    throw new AppError('Creator address is required', 400);
  }

  const user = await (prisma as any).verxioUser.findFirst({
    where: { creatorAddress },
    select: {
      email: true,
    },
  });

  if (!user) {
    throw new AppError('User not found for creator address', 404);
  }

  return user.email;
};

export const issueVerxio = async (data: IssueVerxioData, adminApiKey: string) => {
  const { email, amount, description } = data;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  if (!amount || amount <= 0) {
    throw new AppError('Amount must be greater than 0', 400);
  }

  // Verify admin API key
  const validApiKeys = process.env.API_KEYS?.split(',') || [];
  if (process.env.API_KEY) {
    validApiKeys.push(process.env.API_KEY);
  }

  if (!validApiKeys.includes(adminApiKey)) {
    throw new AppError('Unauthorized: Invalid admin API key', 401);
  }

  // Check if user exists
  const user = await prisma.verxioUser.findFirst({
    where: { email },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Update balance and create transaction
  const updatedUser = await prisma.verxioUser.update({
    where: { id: user.id },
    data: {
      verxioBalance: {
        increment: amount,
      },
    },
    select: {
      id: true,
      email: true,
      verxioBalance: true,
      creatorAddress: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Create transaction record
  await prisma.verxioTransaction.create({
    data: {
      fromUserId: null, // Admin issued (no sender)
      toUserId: updatedUser.id,
      amount,
      description: description || `Admin issued ${amount} Verxio credits`,
    },
  });

  return {
    success: true,
    user: updatedUser,
    message: `Successfully issued ${amount} Verxio credits to ${email}`,
  };
};

export const transferVerxio = async (data: TransferVerxioData) => {
  const { fromEmail, toEmail, amount, description } = data;

  if (!fromEmail || !toEmail) {
    throw new AppError('Both sender and recipient emails are required', 400);
  }

  if (fromEmail === toEmail) {
    throw new AppError('Cannot transfer Verxio to yourself', 400);
  }

  if (!amount || amount <= 0) {
    throw new AppError('Amount must be greater than 0', 400);
  }

  // Check if both users exist
  const fromUser = await prisma.verxioUser.findFirst({
    where: { email: fromEmail },
  });

  if (!fromUser) {
    throw new AppError(`Sender user with email ${fromEmail} not found`, 404);
  }

  const toUser = await prisma.verxioUser.findFirst({
    where: { email: toEmail },
  });

  if (!toUser) {
    throw new AppError(`Recipient user with email ${toEmail} not found`, 404);
  }

  // Check if sender has enough balance
  if (fromUser.verxioBalance < amount) {
    throw new AppError(
      `Insufficient balance. Available: ${fromUser.verxioBalance}, Required: ${amount}`,
      400
    );
  }

  // Perform transfer in a transaction
  const result = await (prisma.$transaction as <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>)(
    async (tx: Prisma.TransactionClient) => {
    // Deduct from sender
    const updatedFromUser = await (tx as any).verxioUser.update({
      where: { id: fromUser.id },
      data: {
        verxioBalance: {
          decrement: amount,
        },
      },
      select: {
        id: true,
        email: true,
        verxioBalance: true,
        creatorAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Add to recipient
    const updatedToUser = await (tx as any).verxioUser.update({
      where: { id: toUser.id },
      data: {
        verxioBalance: {
          increment: amount,
        },
      },
      select: {
        id: true,
        email: true,
        verxioBalance: true,
        creatorAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create transaction record
    await tx.verxioTransaction.create({
      data: {
        fromUserId: updatedFromUser.id,
        toUserId: updatedToUser.id,
        amount,
        description: description || `Transfer from ${fromEmail} to ${toEmail}`,
      },
    });

    return { fromUser: updatedFromUser, toUser: updatedToUser };
    }
  );

  return {
    success: true,
    fromUser: result.fromUser,
    toUser: result.toUser,
    message: `Successfully transferred ${amount} Verxio credits from ${fromEmail} to ${toEmail}`,
  };
};

