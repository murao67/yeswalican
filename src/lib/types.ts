export interface Member {
  id: string;
  name: string;
  ratio: number; // 負担倍率 (デフォルト1.0, 子ども0.5等)
}

export interface CustomAmount {
  memberId: string;
  amount: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  payerId: string;
  participantIds: string[]; // 負担するメンバーのID
  customAmounts: CustomAmount[]; // 個別指定額
}

export interface AppData {
  members: Member[];
  expenses: Expense[];
}

export interface Settlement {
  fromId: string;
  toId: string;
  amount: number;
}
