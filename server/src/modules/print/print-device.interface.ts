/**
 * 3D 打印硬件对接扩展接口（预留）
 * 后续对接真实打印机时，实现该接口并注入到 PrintDispatchService
 */
export interface PrintDeviceInterface {
  /** 设备名称 */
  name: string;

  /** 向打印机下发打印任务 */
  sendTask(task: PrintTask): Promise<void>;

  /** 查询打印机状态 */
  getStatus(): Promise<PrinterStatus>;
}

export interface PrintTask {
  orderNo: string;
  modelPath: string;
  volume: number; // cm³
  material: {
    density: number;
    pricePerGram: number;
    infillRate: number;
  };
  estimatedCost: number;
  /** 学生下单时选择的打印配置（设备 / 填充 / 支撑 / 颜色） */
  printParams?: {
    deviceId?: string | null;
    infillRate?: number | null;
    supports?: number | null;
    color?: string | null;
  };
  /** 订单绑定的打印设备 ID */
  printerDeviceId?: string | null;
}

export type PrinterStatus = 'idle' | 'printing' | 'error' | 'offline';
