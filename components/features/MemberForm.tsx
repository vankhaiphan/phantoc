"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  PersonInputSchema,
  type PersonInput,
} from "@/lib/validation/person";
import { createPerson, updatePerson } from "@/app/actions/member";
import type { Branch, Person } from "@/types";

interface MemberFormProps {
  branches: Branch[];
  /** When provided, the form is in "edit" mode. */
  existing?: Person;
}

export default function MemberForm({ branches, existing }: MemberFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<PersonInput>({
    resolver: zodResolver(PersonInputSchema),
    defaultValues: existing
      ? {
          full_name: existing.full_name,
          other_names: existing.other_names ?? "",
          gender: existing.gender,
          branch_id: existing.branch_id ?? "",
          birth_year: existing.birth_year,
          birth_month: existing.birth_month,
          birth_day: existing.birth_day,
          death_year: existing.death_year,
          death_month: existing.death_month,
          death_day: existing.death_day,
          death_lunar_year: existing.death_lunar_year,
          death_lunar_month: existing.death_lunar_month,
          death_lunar_day: existing.death_lunar_day,
          is_deceased: existing.is_deceased,
          is_in_law: existing.is_in_law,
          birth_order: existing.birth_order,
          generation: existing.generation,
          avatar_url: existing.avatar_url ?? "",
          note: existing.note ?? "",
        }
      : {
          gender: "male",
          branch_id: branches[0]?.id ?? "",
          is_deceased: false,
          is_in_law: false,
        },
  });

  const isDeceased = watch("is_deceased");

  const onSubmit = (data: PersonInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = existing
        ? await updatePerson(existing.id, data)
        : await createPerson(data);

      if (!result.ok) {
        setServerError(result.error ?? "Có lỗi xảy ra.");
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setError(field as keyof PersonInput, {
              type: "server",
              message: message ?? "",
            });
          }
        }
        return;
      }

      if (result.id) {
        router.push(`/bang-dieu-khien/thanh-vien/${result.id}`);
        router.refresh();
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-10 max-w-2xl"
      noValidate
    >
      {/* ── Tên gọi ─────────────────────────────────────────────────────── */}
      <Section title="Tên gọi">
        <Field label="Họ và tên *" error={errors.full_name?.message}>
          <input
            type="text"
            autoFocus
            {...register("full_name")}
            className={inputClass}
            placeholder="Phan Văn ..."
          />
        </Field>

        <Field
          label="Tên gọi khác (tên húy, tên thường gọi)"
          error={errors.other_names?.message}
        >
          <input
            type="text"
            {...register("other_names")}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Giới tính *" error={errors.gender?.message}>
            <select {...register("gender")} className={inputClass}>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </Field>

          <Field label="Chi tộc" error={errors.branch_id?.message}>
            <select {...register("branch_id")} className={inputClass}>
              <option value="">— Chưa chọn —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            id="is_in_law"
            type="checkbox"
            {...register("is_in_law")}
            className="w-4 h-4"
            style={{ accentColor: "var(--color-lacquer)" }}
          />
          <label
            htmlFor="is_in_law"
            className="text-sm"
            style={{ color: "var(--color-ink)" }}
          >
            Là dâu / rể (kết hôn vào dòng họ)
          </label>
        </div>
      </Section>

      {/* ── Ngày tháng ──────────────────────────────────────────────────── */}
      <Section title="Ngày tháng">
        <p className="text-sm" style={{ color: "var(--color-sepia)" }}>
          Có thể bỏ trống nếu chưa rõ. Chỉ năm cũng được — gia phả cổ thường
          không ghi đầy đủ ngày tháng sinh tử.
        </p>

        <div>
          <p className="text-sm font-serif mb-2">Sinh</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Năm" error={errors.birth_year?.message}>
              <input
                type="number"
                {...register("birth_year")}
                className={inputClass}
                placeholder="1950"
              />
            </Field>
            <Field label="Tháng" error={errors.birth_month?.message}>
              <input
                type="number"
                {...register("birth_month")}
                className={inputClass}
              />
            </Field>
            <Field label="Ngày" error={errors.birth_day?.message}>
              <input
                type="number"
                {...register("birth_day")}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            id="is_deceased"
            type="checkbox"
            {...register("is_deceased")}
            className="w-4 h-4"
            style={{ accentColor: "var(--color-lacquer)" }}
          />
          <label
            htmlFor="is_deceased"
            className="text-sm"
            style={{ color: "var(--color-ink)" }}
          >
            Đã mất
          </label>
        </div>

        {isDeceased && (
          <>
            <div>
              <p className="text-sm font-serif mb-2">Mất (dương lịch)</p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Năm" error={errors.death_year?.message}>
                  <input
                    type="number"
                    {...register("death_year")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Tháng" error={errors.death_month?.message}>
                  <input
                    type="number"
                    {...register("death_month")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ngày" error={errors.death_day?.message}>
                  <input
                    type="number"
                    {...register("death_day")}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="text-sm font-serif mb-2">
                Mất (âm lịch — ngày giỗ)
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Năm" error={errors.death_lunar_year?.message}>
                  <input
                    type="number"
                    {...register("death_lunar_year")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Tháng" error={errors.death_lunar_month?.message}>
                  <input
                    type="number"
                    {...register("death_lunar_month")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ngày" error={errors.death_lunar_day?.message}>
                  <input
                    type="number"
                    {...register("death_lunar_day")}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ── Vị trí trong gia phả ────────────────────────────────────────── */}
      <Section title="Vị trí trong gia phả">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Thứ tự sinh trong nhà"
            error={errors.birth_order?.message}
          >
            <input
              type="number"
              min={1}
              {...register("birth_order")}
              className={inputClass}
              placeholder="1, 2, 3..."
            />
          </Field>
          <Field label="Thế hệ thứ" error={errors.generation?.message}>
            <input
              type="number"
              min={0}
              {...register("generation")}
              className={inputClass}
              placeholder="1, 2, 3..."
            />
          </Field>
        </div>
      </Section>

      {/* ── Câu chuyện ──────────────────────────────────────────────────── */}
      <Section title="Câu chuyện">
        <Field label="Ảnh đại diện (URL)" error={errors.avatar_url?.message}>
          <input
            type="url"
            {...register("avatar_url")}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>

        <Field label="Ghi chú" error={errors.note?.message}>
          <textarea
            {...register("note")}
            rows={5}
            className={inputClass}
            placeholder="Nghề nghiệp, quê quán, kỷ niệm, câu chuyện..."
          />
        </Field>
      </Section>

      {serverError && (
        <p
          role="alert"
          className="text-sm px-4 py-3"
          style={{
            backgroundColor: "rgba(122,31,44,0.08)",
            color: "var(--color-lacquer-deep)",
            borderLeft: "3px solid var(--color-lacquer)",
            borderRadius: "var(--radius-paper)",
          }}
        >
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-3 font-serif text-base disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          style={{
            backgroundColor: "var(--color-lacquer)",
            color: "var(--color-ivory)",
            borderRadius: "var(--radius-paper)",
          }}
        >
          {isPending
            ? "Đang lưu…"
            : existing
              ? "Lưu thay đổi"
              : "Thêm thành viên"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 font-serif text-base"
          style={{
            color: "var(--color-ink)",
            backgroundColor: "transparent",
          }}
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}

// ── Internal layout helpers ──────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-2.5 text-base bg-[var(--color-parchment-warm)] " +
  "border border-[rgba(26,23,20,0.12)] rounded-[var(--radius-paper)] " +
  "text-[var(--color-ink)] focus:outline-none";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-5">
      <legend
        className="font-serif text-xl mb-2"
        style={{ color: "var(--color-ink)" }}
      >
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-sm mb-1.5"
        style={{ color: "var(--color-ink)" }}
      >
        {label}
      </label>
      {children}
      {error && (
        <p
          className="text-xs mt-1"
          style={{ color: "var(--color-lacquer)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
