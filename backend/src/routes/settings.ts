import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const router = Router();

// Public endpoint for target levels (accessible to all authenticated users)
router.get('/public/target-levels', auth, async (req: AuthRequest, res, next) => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'dashboard' }
    });
    
    const userRole = req.user?.role;
    const isSeniorAgent = userRole === 'SeniorAgent';
    
    const defaultLevels = {
      agent: {
        level1: 40,
        level2: 60,
        level3: 80,
        level4: 100
      },
      seniorAgent: {
        level1: 60,
        level2: 80,
        level3: 100,
        level4: 120
      }
    };

    const defaultNames = {
      agent: {
        level1: 'BRONZE',
        level2: 'SILVER',
        level3: 'GOLD',
        level4: 'PLATINUM'
      },
      seniorAgent: {
        level1: 'BRONZE',
        level2: 'SILVER',
        level3: 'GOLD',
        level4: 'PLATINUM'
      }
    };
    
    const defaultVisibility = {
      todayPerformance: {
        showTotal: true,
        showQualified: true,
        showDisqualified: true,
        showPending: true,
        showCallback: true,
        showDuplicate: true
      },
      monthlyOverview: {
        showTotal: true,
        showQualified: true,
        showDisqualified: true,
        showDuplicate: true,
        showPending: false,
        showCallback: false
      }
    };
    
    if (setting && setting.value) {
      const dashboardSettings = setting.value as any;
      const targetLevels = dashboardSettings.targetLevels || defaultLevels;
      const levelNames = dashboardSettings.levelNames || defaultNames;
      const todayPerformance = dashboardSettings.todayPerformance || defaultVisibility.todayPerformance;
      const monthlyOverview = dashboardSettings.monthlyOverview || defaultVisibility.monthlyOverview;
      
      // Return data for the user's role
      const role = isSeniorAgent ? 'seniorAgent' : 'agent';
      res.json({
        targetLevels: targetLevels[role] || targetLevels.agent || defaultLevels.agent,
        levelNames: levelNames[role] || levelNames.agent || defaultNames.agent,
        todayPerformance,
        monthlyOverview
      });
    } else {
      const role = isSeniorAgent ? 'seniorAgent' : 'agent';
      res.json({
        targetLevels: defaultLevels[role],
        levelNames: defaultNames[role],
        todayPerformance: defaultVisibility.todayPerformance,
        monthlyOverview: defaultVisibility.monthlyOverview
      });
    }
  } catch (error) {
    console.error('Failed to fetch target levels:', error);
    res.json({
      targetLevels: {
        level1: 40,
        level2: 60,
        level3: 80,
        level4: 100
      },
      levelNames: {
        level1: 'BRONZE',
        level2: 'SILVER',
        level3: 'GOLD',
        level4: 'PLATINUM'
      }
    });
  }
});

// All other settings routes require Manager role
router.use(auth);
router.use(requireRole([UserRole.Manager]));

// Default settings
const DEFAULT_SETTINGS = {
  workSchedule: {
    workStartTime: '17:00',
    workEndTime: '02:00',
    dailyResetTime: '04:00',
    monthlyResetDay: 1,
    monthlyResetTime: '04:00',
    timezone: 'Africa/Cairo'
  },
  leadManagement: {
    pendingPersist: true,
    callbackPersist: true,
    qualifiedVisibleDays: 1,
    autoArchiveDays: 0,
    duplicateCheckPhone: true,
    duplicateCheckAddress: true,
    normalizePhone: true,
    fuzzyAddressMatch: false
  },
  serialNumber: {
    prefix: 'CORV',
    dateFormat: 'YYYYMMDD',
    separator: '-',
    counterDigits: 4,
    resetDaily: true,
    resetMonthly: false
  },
  dashboard: {
    todayPerformance: {
      showTotal: true,
      showQualified: true,
      showDisqualified: true,
      showPending: true,
      showCallback: true,
      showDuplicate: true
    },
    monthlyOverview: {
      showTotal: true,
      showQualified: true,
      showDisqualified: true,
      showDuplicate: true,
      showPending: false,
      showCallback: false
    },
    leaderboard: {
      rankingBy: 'qualified',
      showAgentRankings: true,
      showTeamRankings: true
    },
    targetLevels: {
      agent: {
        level1: 40,
        level2: 60,
        level3: 80,
        level4: 100
      },
      seniorAgent: {
        level1: 60,
        level2: 80,
        level3: 100,
        level4: 120
      }
    },
    levelNames: {
      agent: {
        level1: 'BRONZE',
        level2: 'SILVER',
        level3: 'GOLD',
        level4: 'PLATINUM'
      },
      seniorAgent: {
        level1: 'BRONZE',
        level2: 'SILVER',
        level3: 'GOLD',
        level4: 'PLATINUM'
      }
    }
  },
  dataRetention: {
    qualifiedDays: 90,
    disqualifiedDays: 30,
    duplicateDays: 30,
    pendingDays: 0, // 0 = forever
    callbackDays: 0, // 0 = forever
    autoArchive: true,
    deleteArchivedAfterDays: 365
  },
  company: {
    name: 'Corvia CRM',
    logo: '',
    primaryColor: '#06b6d4',
    secondaryColor: '#10b981',
    email: '',
    phone: '',
    address: '',
    timezone: 'Africa/Cairo',
    currency: 'EGP'
  },
  backup: {
    autoBackup: true,
    backupTime: '03:00',
    keepBackupDays: 30,
    lastBackup: null
  }
};

// Get all settings
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const settings = await prisma.systemSettings.findMany();
    
    // Convert to object format
    const settingsObj: any = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    // Merge with defaults for any missing settings
    const completeSettings = {
      ...DEFAULT_SETTINGS,
      ...settingsObj
    };
    
    res.json(completeSettings);
  } catch (error) {
    next(error);
  }
});

// Get specific setting by key
router.get('/:key', async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.params;
    
    const setting = await prisma.systemSettings.findUnique({
      where: { key }
    });
    
    if (!setting) {
      // Return default if exists
      const defaultValue = (DEFAULT_SETTINGS as any)[key];
      if (defaultValue) {
        return res.json({ key, value: defaultValue, isDefault: true });
      }
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ key: setting.key, value: setting.value, isDefault: false });
  } catch (error) {
    next(error);
  }
});

// Update or create setting
router.put('/:key', async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!value) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    // Determine category from key
    const category = key.split('.')[0] || 'general';
    
    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value,
        updatedBy: req.user?.userId,
        category
      },
      create: {
        key,
        value,
        category,
        updatedBy: req.user?.userId
      }
    });
    
    res.json(setting);
  } catch (error) {
    next(error);
  }
});

// Bulk update settings
router.post('/bulk', async (req: AuthRequest, res, next) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    
    const updates = [];
    
    for (const [key, value] of Object.entries(settings)) {
      const category = key.split('.')[0] || 'general';
      
      updates.push(
        prisma.systemSettings.upsert({
          where: { key },
          update: {
            value: value as any,
            updatedBy: req.user?.userId,
            category
          },
          create: {
            key,
            value: value as any,
            category,
            updatedBy: req.user?.userId
          }
        })
      );
    }
    
    await Promise.all(updates);
    
    res.json({ message: 'Settings updated successfully', count: updates.length });
  } catch (error) {
    next(error);
  }
});

// Reset to defaults
router.post('/reset', async (req: AuthRequest, res, next) => {
  try {
    const { category } = req.body;
    
    if (category) {
      // Reset specific category
      await prisma.systemSettings.deleteMany({
        where: { category }
      });
      res.json({ message: `${category} settings reset to defaults` });
    } else {
      // Reset all
      await prisma.systemSettings.deleteMany({});
      res.json({ message: 'All settings reset to defaults' });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
