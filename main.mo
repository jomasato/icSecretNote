import Principal "mo:base/Principal";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Option "mo:base/Option";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Bool "mo:base/Bool";
import Time "mo:base/Time";
import Int "mo:base/Int";

actor DigitalInheritance {
  // 各ユーザーのデータ構造
  type AccountData = {
    owner: Principal;
    memos: [Memo];
    inheritanceConfig: ?InheritanceConfig;
  };

  // メモデータ構造
  type Memo = {
    id: Text;
    title: Text;
    content: Text;
    createdAt: Int;
    updatedAt: Int;
  };

  // 相続設定の構造
  type InheritanceConfig = {
    successorId: Principal;  // 相続後操作用II
    guardians: [Principal];  // 遺族/ガーディアンのII一覧
    threshold: Nat;          // 必要な合意数
    approvals: [Principal];  // 合意したガーディアン一覧
    isTransferred: Bool;     // 相続完了フラグ
  };

  // ガーディアン連絡先情報を保存するための型定義
    type GuardianContactInfo = {
    name: ?Text;
    contactInfo: ?Text;  // JSON形式で保存（email, phone, relationship等）
    lastUpdated: Int;    // 最終更新タイムスタンプ
    };
// 既存のシェア情報を拡張
type KeyShare = {
  shareId: Text;
  encryptedShare: Blob;
  guardianPrincipal: Principal;
  userPrincipal: Principal;
  metadata: ?Text;     // メタデータを追加（作成日時、説明など）
};

// 相続リクエストの詳細情報
type RecoverySessionInfo = {
  principal: Principal;  // ユーザープリンシパル
  userName: ?Text;       // ユーザー名（オプション）
  requestTime: Int;      // リクエスト時間
  deviceLost: Bool;      // デバイス紛失フラグ
  reason: ?Text;         // 相続理由（オプション）
  requestedBy: Principal; // リクエスト元
};

  // ユーザーデータのストレージ (Principal -> AccountData)
  private stable var accountEntries : [(Principal, AccountData)] = [];
  private var accounts = HashMap.HashMap<Principal, AccountData>(10, Principal.equal, Principal.hash);

// ガーディアン情報を保存するハッシュマップ
private stable var guardianInfoEntries : [(Principal, GuardianContactInfo)] = [];
private var guardianInfoMap = HashMap.HashMap<Principal, GuardianContactInfo>(10, Principal.equal, Principal.hash);

// 相続セッション情報を保存するハッシュマップ
private stable var recoverySessionEntries : [(Principal, RecoverySessionInfo)] = [];
private var recoverySessions = HashMap.HashMap<Principal, RecoverySessionInfo>(10, Principal.equal, Principal.hash);

// アップグレード処理を拡張
system func preupgrade() {
  accountEntries := Iter.toArray(accounts.entries());
  guardianInfoEntries := Iter.toArray(guardianInfoMap.entries());
  recoverySessionEntries := Iter.toArray(recoverySessions.entries());
};

system func postupgrade() {
  accounts := HashMap.fromIter<Principal, AccountData>(
    Iter.fromArray(accountEntries), 10, Principal.equal, Principal.hash
  );
  guardianInfoMap := HashMap.fromIter<Principal, GuardianContactInfo>(
    Iter.fromArray(guardianInfoEntries), 10, Principal.equal, Principal.hash
  );
  recoverySessions := HashMap.fromIter<Principal, RecoverySessionInfo>(
    Iter.fromArray(recoverySessionEntries), 10, Principal.equal, Principal.hash
  );
  accountEntries := [];
  guardianInfoEntries := [];
  recoverySessionEntries := [];
};

  // =================== アカウント・メモ管理機能 =================== 

  // 新規アカウント作成
  public shared(msg) func createAccount() : async Bool {
    let caller = msg.caller;
    
    if (Option.isSome(accounts.get(caller))) {
      return false; // アカウントがすでに存在
    };

    let newAccount : AccountData = {
      owner = caller;
      memos = [];
      inheritanceConfig = null;
    };

    accounts.put(caller, newAccount);
    return true;
  };

  // メモ作成
  public shared(msg) func createMemo(title: Text, content: Text) : async Bool {
    let caller = msg.caller;
    
    switch (accounts.get(caller)) {
      case (null) { return false }; // アカウントが存在しない
      case (?account) {
        let timestamp = Time.now();
        let newMemo : Memo = {
          id = Principal.toText(caller) # "-" # Int.toText(timestamp);
          title = title;
          content = content;
          createdAt = timestamp;
          updatedAt = timestamp;
        };

        let updatedMemos = Array.append<Memo>(account.memos, [newMemo]);
        let updatedAccount : AccountData = {
          owner = account.owner;
          memos = updatedMemos;
          inheritanceConfig = account.inheritanceConfig;
        };

        accounts.put(caller, updatedAccount);
        return true;
      };
    };
  };

  // メモ一覧取得
  public shared(msg) func getMemos() : async [Memo] {
    let caller = msg.caller;
    
    switch (accounts.get(caller)) {
      case (null) { return [] }; // アカウントが存在しない
      case (?account) {
        return account.memos;
      };
    };
  };

  // =================== 相続設定機能 =================== 

  // ガーディアン管理関数の拡張
    public shared(msg) func manageGuardian(
    guardianId: Principal,
    action: GuardianAction,
    encryptedShare: ?Blob,
    contactInfo: ?Text
    ) : async Result<()> {
    let caller = msg.caller;
    
    switch (accounts.get(caller)) {
        case (null) { return #err("アカウントが見つかりません") };
        case (?account) {
        switch (action) {
            case (#Add) {
            // 既存のガーディアン追加ロジック
            
            // 連絡先情報がある場合は保存
            if (Option.isSome(contactInfo)) {
                guardianInfoMap.put(guardianId, {
                name = null;
                contactInfo = contactInfo;
                lastUpdated = Time.now();
                });
            };
            
            return #ok();
            };
            
            case (#Remove) {
            // 既存のガーディアン削除ロジック
            
            // ガーディアン情報も削除
            guardianInfoMap.delete(guardianId);
            
            return #ok();
            };
            
            case (#Replace(newGuardian)) {
            // 既存のガーディアン置換ロジック
            
            // 連絡先情報を更新
            if (Option.isSome(contactInfo)) {
                guardianInfoMap.put(guardianId, {
                name = null;
                contactInfo = contactInfo;
                lastUpdated = Time.now();
                });
            };
            
            return #ok();
            };
        };
        };
    };
    };

    // ガーディアン情報の取得
    public query func getGuardianContactInfo(guardianId: Principal) : async ?GuardianContactInfo {
    return guardianInfoMap.get(guardianId);
    };

  // 相続設定の登録・更新
  public shared(msg) func setInheritanceConfig(
    successorId: Principal,
    guardians: [Principal],
    threshold: Nat
  ) : async Bool {
    let caller = msg.caller;
    
    switch (accounts.get(caller)) {
      case (null) { return false }; // アカウントが存在しない
      case (?account) {
        // 閾値のバリデーション (少なくとも1人以上、ガーディアン全員以下)
        if (threshold < 1 or threshold > guardians.size()) {
          return false;
        };

        let newConfig : InheritanceConfig = {
          successorId = successorId;
          guardians = guardians;
          threshold = threshold;
          approvals = [];
          isTransferred = false;
        };

        let updatedAccount : AccountData = {
          owner = account.owner;
          memos = account.memos;
          inheritanceConfig = ?newConfig;
        };

        accounts.put(caller, updatedAccount);
        return true;
      };
    };
  };

  // 現在の相続設定を取得
  public shared(msg) func getInheritanceConfig() : async ?InheritanceConfig {
    let caller = msg.caller;
    
    switch (accounts.get(caller)) {
      case (null) { return null }; // アカウントが存在しない
      case (?account) {
        return account.inheritanceConfig;
      };
    };
  };

  // シェアIDとメタデータを関連付ける
public shared(msg) func storeKeyShare(
  shareId: Text,
  encryptedShareData: Blob,  // 空でも可（クライアント側で保存）
  ownerPrincipal: Principal
) : async Result<()> {
  let caller = msg.caller;
  
  // 呼び出し者が有効なユーザーかチェック
  switch (accounts.get(caller)) {
    case (null) { return #err("アカウントが見つかりません") };
    case (?account) {
      // シェア情報を保存（実際のシェアデータはクライアント側）
      // 実装方法に応じて詳細設計
      
      return #ok();
    };
  };
};

// シェア情報の取得を拡張（メタデータ含む）
public query func getMyKeyShare(ownerPrincipal: Principal) : async Result<KeyShare> {
  // 既存の実装を拡張し、メタデータも返す
  // 実装方法に応じて詳細設計
  
  return #err("未実装");
};

  // =================== 相続プロセス機能 =================== 

  // 相続リクエスト開始（ガーディアンが呼び出し）
public shared(msg) func requestInheritanceTransfer(
  accountId: Principal,
  reason: ?Text
) : async Result<()> {
  let caller = msg.caller;
  
  switch (accounts.get(accountId)) {
    case (null) { return #err("アカウントが見つかりません") };
    case (?account) {
      switch (account.inheritanceConfig) {
        case (null) { return #err("相続設定が存在しません") };
        case (?config) {
          // 呼び出し者がガーディアンかどうか確認
          let isGuardian = Array.find<Principal>(
            config.guardians, 
            func(p) { Principal.equal(p, caller) }
          );
          
          if (Option.isNull(isGuardian)) {
            return #err("あなたはこのアカウントのガーディアンではありません");
          };
          
          // 相続リクエストを保存
          let sessionInfo : RecoverySessionInfo = {
            principal = accountId;
            userName = null; // ユーザー名はバックエンドで管理していないため
            requestTime = Time.now();
            deviceLost = true; // デフォルト値
            reason = reason;
            requestedBy = caller;
          };
          
          recoverySessions.put(accountId, sessionInfo);
          
          // 相続プロセスを開始（approveInheritanceの準備）
          // 既存のapproveInheritance関数と連携
          
          return #ok();
        };
      };
    };
  };
};

// 保留中の相続リクエスト情報取得
public query func getRecoverySessionInfo(userPrincipal: Principal) : async ?RecoverySessionInfo {
  return recoverySessions.get(userPrincipal);
};

// 相続リクエスト一覧の取得（自分が承認すべきリクエスト）
public query(msg) func getPendingGuardianApprovals() : async [RecoverySessionInfo] {
  let caller = msg.caller;
  let pending : [RecoverySessionInfo] = [];
  
  // すべての相続セッションをチェック
  for ((principal, session) in recoverySessions.entries()) {
    switch (accounts.get(principal)) {
      case (null) { /* アカウントが存在しない場合はスキップ */ };
      case (?account) {
        switch (account.inheritanceConfig) {
          case (null) { /* 相続設定がない場合はスキップ */ };
          case (?config) {
            // 呼び出し者がガーディアンかどうか確認
            let isGuardian = Array.find<Principal>(
              config.guardians, 
              func(p) { Principal.equal(p, caller) }
            );
            
            // このユーザーがガーディアンで、まだ承認していない場合
            if (Option.isSome(isGuardian)) {
              let alreadyApproved = Array.find<Principal>(
                config.approvals, 
                func(p) { Principal.equal(p, caller) }
              );
              
              if (Option.isNull(alreadyApproved) and not config.isTransferred) {
                pending := Array.append<RecoverySessionInfo>(pending, [session]);
              };
            };
          };
        };
      };
    };
  };
  
  return pending;
};

  // ガーディアンによる合意登録
  public shared(msg) func approveInheritance(accountId: Principal) : async Bool {
    let caller = msg.caller;
    
    switch (accounts.get(accountId)) {
      case (null) { return false }; // アカウントが存在しない
      case (?account) {
        switch (account.inheritanceConfig) {
          case (null) { return false }; // 相続設定が存在しない
          case (?config) {
            // 既に相続済みの場合は拒否
            if (config.isTransferred) {
              return false;
            };

            // ガーディアンかどうか確認
            let isGuardian = Array.find<Principal>(
              config.guardians, 
              func(p) { Principal.equal(p, caller) }
            );
            
            if (Option.isNull(isGuardian)) {
              return false; // ガーディアンではない
            };

            // 既に承認済みかチェック
            let alreadyApproved = Array.find<Principal>(
              config.approvals, 
              func(p) { Principal.equal(p, caller) }
            );
            
            if (Option.isSome(alreadyApproved)) {
              return true; // 既に承認済み
            };

            // 承認を追加
            let newApprovals = Array.append<Principal>(config.approvals, [caller]);
            
            let updatedConfig : InheritanceConfig = {
              successorId = config.successorId;
              guardians = config.guardians;
              threshold = config.threshold;
              approvals = newApprovals;
              isTransferred = newApprovals.size() >= config.threshold;
            };

            let updatedAccount : AccountData = {
              owner = account.owner;
              memos = account.memos;
              inheritanceConfig = ?updatedConfig;
            };

            accounts.put(accountId, updatedAccount);
            return true;
          };
        };
      };
    };
  };

  // 相続者によるメモ一覧取得
  public shared(msg) func getInheritedMemos(accountId: Principal) : async [Memo] {
    let caller = msg.caller;
    
    switch (accounts.get(accountId)) {
      case (null) { return [] }; // アカウントが存在しない
      case (?account) {
        switch (account.inheritanceConfig) {
          case (null) { return [] }; // 相続設定が存在しない
          case (?config) {
            // 相続完了かつ相続者と一致するかを確認
            if (config.isTransferred and Principal.equal(config.successorId, caller)) {
              return account.memos;
            } else {
              return [];
            };
          };
        };
      };
    };
  };

  // 相続状態の確認 (フロントエンド用)
  public query func checkInheritanceStatus(accountId: Principal) : async {
    exists: Bool;
    configured: Bool;
    transferred: Bool;
    currentApprovals: Nat;
    requiredApprovals: Nat;
  } {
    switch (accounts.get(accountId)) {
      case (null) {
        return {
          exists = false;
          configured = false;
          transferred = false;
          currentApprovals = 0;
          requiredApprovals = 0;
        };
      };
      case (?account) {
        switch (account.inheritanceConfig) {
          case (null) {
            return {
              exists = true;
              configured = false;
              transferred = false;
              currentApprovals = 0;
              requiredApprovals = 0;
            };
          };
          case (?config) {
            return {
              exists = true;
              configured = true;
              transferred = config.isTransferred;
              currentApprovals = config.approvals.size();
              requiredApprovals = config.threshold;
            };
          };
        };
      };
    };
  };
}