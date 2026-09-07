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
}

export type PrinterStatus = 'idle' | 'printing' | 'error' | 'offline';
