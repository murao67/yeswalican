This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Supabase keep-alive（無料プランの自動停止対策）

Supabase 無料プランは「過去1週間に十分なDBアクティビティ（目安: 1日数回のリクエスト）」がないとプロジェクトが自動一時停止されるため、2系統で定期アクセスを発生させている。

- **Vercel Cron**: 毎日 03:00 UTC に `/api/keep-alive` を実行（[vercel.json](vercel.json)。Hobby プランは日次実行が上限）。`CRON_SECRET` 環境変数で保護。
- **GitHub Actions**: 6時間おきに Supabase REST を直接クエリ（[.github/workflows/supabase-keep-alive.yml](.github/workflows/supabase-keep-alive.yml)）。
  - リポジトリシークレット `SUPABASE_ANON_KEY` の設定が必要（`.env.local` の `NEXT_PUBLIC_SUPABASE_ANON_KEY` と同じ値）。
  - リポジトリに60日間コミットがないと GitHub がスケジュール実行を自動停止する（警告メール後。Actions タブから再有効化可能）。

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
