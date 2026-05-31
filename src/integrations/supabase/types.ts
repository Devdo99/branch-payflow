export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      allowance_types: {
        Row: {
          aktif: boolean;
          catatan: string | null;
          created_at: string;
          id: string;
          metode: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal_default: number;
        };
        Insert: {
          aktif?: boolean;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          metode?: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal_default?: number;
        };
        Update: {
          aktif?: boolean;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          metode?: Database["public"]["Enums"]["calc_method"];
          nama?: string;
          nominal_default?: number;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          alamat: string | null;
          catatan: string | null;
          footer_slip: string | null;
          id: number;
          nama_perusahaan: string;
          periode_evaluasi_default: Database["public"]["Enums"]["evaluation_period"];
          slip_template_config: Json;
          updated_at: string;
        };
        Insert: {
          alamat?: string | null;
          catatan?: string | null;
          footer_slip?: string | null;
          id?: number;
          nama_perusahaan?: string;
          periode_evaluasi_default?: Database["public"]["Enums"]["evaluation_period"];
          slip_template_config?: Json;
          updated_at?: string;
        };
        Update: {
          alamat?: string | null;
          catatan?: string | null;
          footer_slip?: string | null;
          id?: number;
          nama_perusahaan?: string;
          periode_evaluasi_default?: Database["public"]["Enums"]["evaluation_period"];
          slip_template_config?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          aktif: boolean;
          alamat: string | null;
          catatan: string | null;
          created_at: string;
          id: string;
          nama: string;
          updated_at: string;
        };
        Insert: {
          aktif?: boolean;
          alamat?: string | null;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          nama: string;
          updated_at?: string;
        };
        Update: {
          aktif?: boolean;
          alamat?: string | null;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          nama?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deduction_types: {
        Row: {
          aktif: boolean;
          catatan: string | null;
          created_at: string;
          id: string;
          metode: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal_default: number;
        };
        Insert: {
          aktif?: boolean;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          metode?: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal_default?: number;
        };
        Update: {
          aktif?: boolean;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          metode?: Database["public"]["Enums"]["calc_method"];
          nama?: string;
          nominal_default?: number;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          aktif: boolean;
          branch_id: string | null;
          catatan_rekening: string | null;
          created_at: string;
          email: string | null;
          gaji_pokok: number;
          id: string;
          jabatan: string | null;
          kode_karyawan: string | null;
          nama: string;
          nama_bank: string | null;
          nama_pemilik_rekening: string | null;
          nomor_rekening: string | null;
          periode_evaluasi: Database["public"]["Enums"]["evaluation_period"];
          status_rekening: Database["public"]["Enums"]["bank_status"];
          tanggal_masuk: string | null;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          aktif?: boolean;
          branch_id?: string | null;
          catatan_rekening?: string | null;
          created_at?: string;
          email?: string | null;
          gaji_pokok?: number;
          id?: string;
          jabatan?: string | null;
          kode_karyawan?: string | null;
          nama: string;
          nama_bank?: string | null;
          nama_pemilik_rekening?: string | null;
          nomor_rekening?: string | null;
          periode_evaluasi?: Database["public"]["Enums"]["evaluation_period"];
          status_rekening?: Database["public"]["Enums"]["bank_status"];
          tanggal_masuk?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          aktif?: boolean;
          branch_id?: string | null;
          catatan_rekening?: string | null;
          created_at?: string;
          email?: string | null;
          gaji_pokok?: number;
          id?: string;
          jabatan?: string | null;
          kode_karyawan?: string | null;
          nama?: string;
          nama_bank?: string | null;
          nama_pemilik_rekening?: string | null;
          nomor_rekening?: string | null;
          periode_evaluasi?: Database["public"]["Enums"]["evaluation_period"];
          status_rekening?: Database["public"]["Enums"]["bank_status"];
          tanggal_masuk?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_item_allowances: {
        Row: {
          allowance_type_id: string | null;
          id: string;
          metode: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal: number;
          payroll_item_id: string;
          qty: number;
          subtotal: number;
        };
        Insert: {
          allowance_type_id?: string | null;
          id?: string;
          metode: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal?: number;
          payroll_item_id: string;
          qty?: number;
          subtotal?: number;
        };
        Update: {
          allowance_type_id?: string | null;
          id?: string;
          metode?: Database["public"]["Enums"]["calc_method"];
          nama?: string;
          nominal?: number;
          payroll_item_id?: string;
          qty?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_item_allowances_allowance_type_id_fkey";
            columns: ["allowance_type_id"];
            isOneToOne: false;
            referencedRelation: "allowance_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_item_allowances_payroll_item_id_fkey";
            columns: ["payroll_item_id"];
            isOneToOne: false;
            referencedRelation: "payroll_items";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_item_deductions: {
        Row: {
          deduction_type_id: string | null;
          id: string;
          metode: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal: number;
          payroll_item_id: string;
          qty: number;
          subtotal: number;
        };
        Insert: {
          deduction_type_id?: string | null;
          id?: string;
          metode: Database["public"]["Enums"]["calc_method"];
          nama: string;
          nominal?: number;
          payroll_item_id: string;
          qty?: number;
          subtotal?: number;
        };
        Update: {
          deduction_type_id?: string | null;
          id?: string;
          metode?: Database["public"]["Enums"]["calc_method"];
          nama?: string;
          nominal?: number;
          payroll_item_id?: string;
          qty?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_item_deductions_deduction_type_id_fkey";
            columns: ["deduction_type_id"];
            isOneToOne: false;
            referencedRelation: "deduction_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_item_deductions_payroll_item_id_fkey";
            columns: ["payroll_item_id"];
            isOneToOne: false;
            referencedRelation: "payroll_items";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_items: {
        Row: {
          bonus_manual: number | null;
          catatan: string | null;
          created_at: string;
          employee_id: string;
          gaji_bersih: number;
          gaji_pokok: number;
          id: string;
          jumlah_absen: number | null;
          jumlah_hari: number | null;
          jumlah_izin: number | null;
          jumlah_jam_lembur: number | null;
          jumlah_telat: number | null;
          kasbon: number | null;
          payroll_run_id: string;
          slip_dibuat: boolean;
          total_potongan: number;
          total_tunjangan: number;
          updated_at: string;
        };
        Insert: {
          bonus_manual?: number | null;
          catatan?: string | null;
          created_at?: string;
          employee_id: string;
          gaji_bersih?: number;
          gaji_pokok?: number;
          id?: string;
          jumlah_absen?: number | null;
          jumlah_hari?: number | null;
          jumlah_izin?: number | null;
          jumlah_jam_lembur?: number | null;
          jumlah_telat?: number | null;
          kasbon?: number | null;
          payroll_run_id: string;
          slip_dibuat?: boolean;
          total_potongan?: number;
          total_tunjangan?: number;
          updated_at?: string;
        };
        Update: {
          bonus_manual?: number | null;
          catatan?: string | null;
          created_at?: string;
          employee_id?: string;
          gaji_bersih?: number;
          gaji_pokok?: number;
          id?: string;
          jumlah_absen?: number | null;
          jumlah_hari?: number | null;
          jumlah_izin?: number | null;
          jumlah_jam_lembur?: number | null;
          jumlah_telat?: number | null;
          kasbon?: number | null;
          payroll_run_id?: string;
          slip_dibuat?: boolean;
          total_potongan?: number;
          total_tunjangan?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey";
            columns: ["payroll_run_id"];
            isOneToOne: false;
            referencedRelation: "payroll_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_runs: {
        Row: {
          branch_id: string | null;
          catatan: string | null;
          created_at: string;
          id: string;
          periode: string;
          status: Database["public"]["Enums"]["payroll_status"];
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          periode: string;
          status?: Database["public"]["Enums"]["payroll_status"];
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          catatan?: string | null;
          created_at?: string;
          id?: string;
          periode?: string;
          status?: Database["public"]["Enums"]["payroll_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_runs_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      salary_history: {
        Row: {
          alasan: string | null;
          catatan: string | null;
          created_at: string;
          employee_id: string;
          gaji_baru: number;
          gaji_lama: number;
          id: string;
          nominal_kenaikan: number | null;
          persentase: number | null;
          tanggal_berlaku: string;
        };
        Insert: {
          alasan?: string | null;
          catatan?: string | null;
          created_at?: string;
          employee_id: string;
          gaji_baru: number;
          gaji_lama: number;
          id?: string;
          nominal_kenaikan?: number | null;
          persentase?: number | null;
          tanggal_berlaku: string;
        };
        Update: {
          alasan?: string | null;
          catatan?: string | null;
          created_at?: string;
          employee_id?: string;
          gaji_baru?: number;
          gaji_lama?: number;
          id?: string;
          nominal_kenaikan?: number | null;
          persentase?: number | null;
          tanggal_berlaku?: string;
        };
        Relationships: [
          {
            foreignKeyName: "salary_history_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      salary_increase_evaluations: {
        Row: {
          catatan: string | null;
          created_at: string;
          employee_id: string;
          id: string;
          nominal_kenaikan: number | null;
          periode_evaluasi: string;
          persentase: number | null;
          status: Database["public"]["Enums"]["evaluation_status"];
          tanggal_berlaku: string | null;
          updated_at: string;
        };
        Insert: {
          catatan?: string | null;
          created_at?: string;
          employee_id: string;
          id?: string;
          nominal_kenaikan?: number | null;
          periode_evaluasi: string;
          persentase?: number | null;
          status?: Database["public"]["Enums"]["evaluation_status"];
          tanggal_berlaku?: string | null;
          updated_at?: string;
        };
        Update: {
          catatan?: string | null;
          created_at?: string;
          employee_id?: string;
          id?: string;
          nominal_kenaikan?: number | null;
          periode_evaluasi?: string;
          persentase?: number | null;
          status?: Database["public"]["Enums"]["evaluation_status"];
          tanggal_berlaku?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "salary_increase_evaluations_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_templates: {
        Row: {
          id: string;
          jenis: string;
          konten: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          jenis: string;
          konten: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          jenis?: string;
          konten?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      bank_status: "valid" | "belum_dicek" | "perlu_dicek_ulang";
      calc_method: "fixed" | "per_day" | "per_hour" | "per_event" | "manual";
      evaluation_period: "3_bulan" | "6_bulan" | "12_bulan" | "manual";
      evaluation_status:
        | "belum_waktunya"
        | "perlu_evaluasi"
        | "disetujui"
        | "ditunda"
        | "sudah_dinaikkan";
      payroll_status: "draft" | "final";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      bank_status: ["valid", "belum_dicek", "perlu_dicek_ulang"],
      calc_method: ["fixed", "per_day", "per_hour", "per_event", "manual"],
      evaluation_period: ["3_bulan", "6_bulan", "12_bulan", "manual"],
      evaluation_status: [
        "belum_waktunya",
        "perlu_evaluasi",
        "disetujui",
        "ditunda",
        "sudah_dinaikkan",
      ],
      payroll_status: ["draft", "final"],
    },
  },
} as const;
