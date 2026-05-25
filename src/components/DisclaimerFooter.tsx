"use client";

import { useState } from "react";

export default function DisclaimerFooter() {
  const [show, setShow] = useState(false);

  return (
    <>
      <footer className="max-w-lg mx-auto px-4 pt-8 pb-6 text-center text-xs text-[var(--muted)]">
        <button
          className="hover:text-[var(--accent)] transition-colors underline-offset-2 hover:underline"
          onClick={() => setShow(true)}
        >
          免責事項
        </button>
      </footer>

      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShow(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto p-6 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">免責事項</h3>
              <button
                className="btn-secondary text-sm !px-3 !py-1"
                onClick={() => setShow(false)}
              >
                閉じる
              </button>
            </div>
            <div className="text-sm leading-relaxed space-y-4 text-[var(--foreground)]">
              <p>
                YesWaliCan（以下「本サービス」）は、立替払いの精算を補助する目的で無償提供される個人開発のツールです。ご利用にあたっては以下の点をご了承ください。
              </p>
              <section>
                <h4 className="font-semibold mb-1">1. 計算結果について</h4>
                <p>
                  本サービスは入力された情報に基づき計算を行いますが、結果の正確性・完全性を保証するものではありません。実際の精算にあたっては、ご自身で内容を確認のうえご利用ください。
                </p>
              </section>
              <section>
                <h4 className="font-semibold mb-1">2. データの取り扱い</h4>
                <p>
                  保存されたイベントデータは、発行されるURLに紐づいて保管されます。データの永続的な保管・バックアップを保証するものではないため、必要に応じて別途控えを保存することを推奨します。
                </p>
              </section>
              <section>
                <h4 className="font-semibold mb-1">3. URLの共有について</h4>
                <p>
                  イベントURLにはパスワード等の保護がかかっていません。URLを知る方は誰でも内容の閲覧・編集が可能です。URLの取り扱いはご利用者の責任にてお願いします。
                </p>
              </section>
              <section>
                <h4 className="font-semibold mb-1">4. 免責</h4>
                <p>
                  本サービスの利用または利用不能により生じたいかなる損害についても、開発者は一切の責任を負いません。
                </p>
              </section>
              <section>
                <h4 className="font-semibold mb-1">5. サービス内容の変更・停止</h4>
                <p>
                  予告なく本サービスの仕様変更・提供停止を行う場合があります。
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
