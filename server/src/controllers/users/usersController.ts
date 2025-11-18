// src/controllers/users/usersController.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../config/prismaClient.js';
import validationMiddleware from '../../middlewares/validation.js';
import { updateUserValidation } from '../../validations/users/user-validation.js';
import { cloudinaryService } from '../../config/claudinary.js';
import {
  asyncHandler,
  ValidationError,
  CustomError,
} from '../../middlewares/error-handler.js';
import type {
  IUser,
  IUsersPaginatedResponse,
  IUserUpdateInput,
  IUserRoleUpdateInput,
} from '../../types/user-profile.types.js';
import conditionalCloudinaryUpload from '../../middlewares/conditional-cloudinary-upload.js';
import multerUpload from '../../config/multer.js';
import {
  HTTP_STATUS_CODES,
  CLOUDINARY_UPLOAD_OPTIONS,
} from '../../config/constants.js';
import { Role, Status } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/client.js';

/**
 * Get all users with pagination, search, and filters
 */
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Query parameters
    const role = req.query.role as Role | undefined;
    const status = req.query.status as Status | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    // Build where clause
    const whereClause: Prisma.UserWhereInput = {};

    if (role) {
      whereClause.role = role;
    }

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Validate sortBy field
    const validSortFields = [
      'createdAt',
      'updatedAt',
      'firstName',
      'lastName',
      'email',
    ];
    const orderBy: Prisma.UserOrderByWithRelationInput =
      validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: 'desc' };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          profilePicture: true,
          createdAt: true,
          updatedAt: true,
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    const response: IUser[] = users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      creator: user.creator,
    }));

    const paginatedResponse: IUsersPaginatedResponse = {
      message: 'Users retrieved successfully',
      data: response,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(paginatedResponse);
  },
);

/**
 * Get a single user by ID
 */
export const getUser = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('Valid user ID is required');
    }

    if (currentUserId !== userId && currentUserRole !== 'ADMIN') {
      res.status(HTTP_STATUS_CODES.FORBIDDEN);
      throw new CustomError(
        HTTP_STATUS_CODES.FORBIDDEN,
        'You can only view your own profile',
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(HTTP_STATUS_CODES.NOT_FOUND);
      throw new CustomError(HTTP_STATUS_CODES.NOT_FOUND, 'User not found');
    }

    const responseData: IUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      creator: user.creator,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: 'User retrieved successfully',
      data: responseData,
    });
  },
);

/**
 * Controller function for updating user details
 */
const handleUpdateUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const userDetails = req.body as IUserUpdateInput;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;


    if (!userId) {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST);
      throw new CustomError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        'User ID is required',
      );
    }

    try {
      const result = await prisma.$transaction(async (prisma) => {
        const existingUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        });

        if (!existingUser) {
          throw new CustomError(HTTP_STATUS_CODES.NOT_FOUND, 'User not found');
        }

        if (currentUserId !== userId && currentUserRole !== 'ADMIN') {
          throw new CustomError(
            HTTP_STATUS_CODES.FORBIDDEN,
            'You can only update your own profile',
          );
        }

        if (currentUserId === userId && currentUserRole !== 'ADMIN') {
          if (
            userDetails.role !== undefined ||
            userDetails.status !== undefined
          ) {
            throw new CustomError(
              HTTP_STATUS_CODES.FORBIDDEN,
              'You cannot modify your own role or status',
            );
          }
        }

        // Check for unique constraint violations
        if (userDetails.email && userDetails.email !== existingUser.email) {
          const emailExists = await prisma.user.findUnique({
            where: { email: userDetails.email },
          });
          if (emailExists) {
            throw new CustomError(
              HTTP_STATUS_CODES.CONFLICT,
              'Email already in use by another user',
            );
          }
        }

        if (userDetails.phone && userDetails.phone !== existingUser.phone) {
          const phoneExists = await prisma.user.findUnique({
            where: { phone: userDetails.phone },
          });
          if (phoneExists) {
            throw new CustomError(
              HTTP_STATUS_CODES.CONFLICT,
              'Phone number already in use by another user',
            );
          }
        }

        const updateData: Prisma.UserUpdateInput = {};

        if (userDetails.firstName !== undefined) {
          updateData.firstName = userDetails.firstName;
        }
        if (userDetails.lastName !== undefined) {
          updateData.lastName = userDetails.lastName;
        }

        if (userDetails.status !== undefined) {
          updateData.status = userDetails.status;
        }

        if (userDetails.role !== undefined) {
          updateData.role = userDetails.role;
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: updateData,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
              },
            },
          },
        });

        return updatedUser;
      });

      const responseData: IUser = {
        id: result.id,
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        phone: result.phone,
        role: result.role,
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        creator: result.creator,
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: 'User updated successfully',
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  },
);

export const updateUser: RequestHandler[] = [
  ...validationMiddleware.update(updateUserValidation),
  handleUpdateUser,
] as const;

/**
 * Update user role only
 */
export const updateUserRole = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const { role } = req.body as IUserRoleUpdateInput;
    const currentUserId = req.user?.id;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Prevent self-role modification
    if (currentUserId === userId) {
      res.status(HTTP_STATUS_CODES.FORBIDDEN);
      throw new CustomError(
        HTTP_STATUS_CODES.FORBIDDEN,
        'You cannot modify your own role',
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!existingUser) {
      res.status(HTTP_STATUS_CODES.NOT_FOUND);
      throw new CustomError(HTTP_STATUS_CODES.NOT_FOUND, 'User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    const responseData: IUser = {
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      status: updatedUser.status,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      creator: updatedUser.creator,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: `User role updated from ${existingUser.role} to ${role} successfully`,
      data: responseData,
    });
  },
);

/**
 * Controller function for updating user profile picture
 */
const handleUpdateUserProfilePicture = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;

    let uploadedImageUrl: string | undefined;
    if (
      req.body.profilePicture &&
      typeof req.body.profilePicture === 'string'
    ) {
      uploadedImageUrl = req.body.profilePicture;
    }

    if (!userId) {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST);
      throw new CustomError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        'User ID is required',
      );
    }

    if (!uploadedImageUrl) {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST);
      throw new CustomError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        'Profile picture is required',
      );
    }

    let oldProfilePicture: string | null = null;

    try {
      const result = await prisma.$transaction(async (prisma) => {
        const existingUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            profilePicture: true,
          },
        });

        if (!existingUser) {
          throw new CustomError(HTTP_STATUS_CODES.NOT_FOUND, 'User not found');
        }

        // Permission check
        if (currentUserId !== userId && currentUserRole !== 'ADMIN') {
          throw new CustomError(
            HTTP_STATUS_CODES.FORBIDDEN,
            'You can only update your own profile picture',
          );
        }

        oldProfilePicture = existingUser.profilePicture;

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { profilePicture: uploadedImageUrl },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            profilePicture: true,
            createdAt: true,
            updatedAt: true,
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
              },
            },
          },
        });

        return updatedUser;
      });

      if (oldProfilePicture && oldProfilePicture !== uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(oldProfilePicture);
        } catch (cleanupError) {
          console.warn('Failed to clean up old profile picture:', cleanupError);
        }
      }

      const responseData: IUser = {
        id: result.id,
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        phone: result.phone,
        role: result.role,
        status: result.status,
        profilePicture: result.profilePicture,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        creator: result.creator,
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: 'Profile picture updated successfully',
        data: responseData,
      });
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(uploadedImageUrl);
        } catch (cleanupError) {
          console.error('Failed to clean up Cloudinary image:', cleanupError);
        }
      }
      next(error);
    }
  },
);

/**
 * Middleware array for profile picture update
 */
export const updateUserProfilePicture: RequestHandler[] = [
  multerUpload.single('profilePicture'),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'profilePicture'),
  handleUpdateUserProfilePicture,
] as const;

/**
 * Delete a single user
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('Valid user ID is required');
    }

    // Prevent self-deletion
    if (currentUserId === userId) {
      res.status(HTTP_STATUS_CODES.FORBIDDEN);
      throw new CustomError(
        HTTP_STATUS_CODES.FORBIDDEN,
        'You cannot delete your own account',
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
      },
    });

    if (!existingUser) {
      res.status(HTTP_STATUS_CODES.NOT_FOUND);
      throw new CustomError(HTTP_STATUS_CODES.NOT_FOUND, 'User not found');
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    if (existingUser.profilePicture) {
      try {
        await cloudinaryService.deleteImage(existingUser.profilePicture);
      } catch (cleanupError) {
        console.warn(
          `Failed to clean up profile picture for deleted user ${userId}:`,
          cleanupError,
        );
      }
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: `User ${existingUser.firstName} ${existingUser.lastName} (${existingUser.email}) deleted successfully`,
    });
  },
);

/**
 * Delete all users - Admin only (dangerous operation)
 */
export const deleteAllUsers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { confirmDelete } = req.body;
    const currentUserId = req.user?.id;

    if (!confirmDelete || confirmDelete !== 'DELETE_ALL_USERS') {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST);
      throw new CustomError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        'This operation requires confirmation. Send { "confirmDelete": "DELETE_ALL_USERS" } in request body.',
      );
    }

    const usersToDelete = await prisma.user.findMany({
      where: {
        id: {
          not: currentUserId!,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
      },
    });

    if (usersToDelete.length === 0) {
      res.status(HTTP_STATUS_CODES.OK).json({
        message: 'No users to delete',
        deletedCount: 0,
      });
      return;
    }

    const profilePicturesToDelete = usersToDelete
      .filter((user) => user.profilePicture)
      .map((user) => user.profilePicture!);

    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: {
          not: currentUserId!,
        },
      },
    });

    if (profilePicturesToDelete.length > 0) {
      const cleanupPromises = profilePicturesToDelete.map(
        async (profilePicture) => {
          try {
            await cloudinaryService.deleteImage(profilePicture);
          } catch (error) {
            console.warn(
              `Failed to clean up profile picture: ${profilePicture}`,
              error,
            );
          }
        },
      );

      Promise.allSettled(cleanupPromises).then((results) => {
        const failed = results.filter(
          (result) => result.status === 'rejected',
        ).length;
        if (failed > 0) {
          console.warn(
            `Failed to clean up ${failed} profile pictures from Cloudinary`,
          );
        }
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: `Successfully deleted ${deleteResult.count} users (excluding yourself)`,
      deletedCount: deleteResult.count,
    });
  },
);
