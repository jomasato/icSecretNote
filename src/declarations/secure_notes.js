export const idlFactory = ({ IDL }) => {
  const DeviceId = IDL.Text;
  const Result_8 = IDL.Variant({ 'ok' : DeviceId, 'err' : IDL.Text });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const RecoveryStatus = IDL.Variant({
    'ApprovalComplete' : IDL.Null,
    'Failed' : IDL.Null,
    'SharesCollected' : IDL.Null,
    'Requested' : IDL.Null,
    'InProgress' : IDL.Null,
    'Completed' : IDL.Null,
  });
  const ShareId = IDL.Text;
  const Time = IDL.Int;
  const RecoverySession = IDL.Record({
    'status' : RecoveryStatus,
    'collectedShares' : IDL.Vec(ShareId),
    'tempAccessPrincipal' : IDL.Opt(IDL.Principal),
    'userPrincipal' : IDL.Principal,
    'requestTime' : Time,
    'approvedGuardians' : IDL.Vec(IDL.Principal),
  });
  const KeyShare = IDL.Record({
    'encryptedShare' : IDL.Vec(IDL.Nat8),
    'guardianPrincipal' : IDL.Principal,
    'shareId' : ShareId,
    'userPrincipal' : IDL.Principal,
  });
  const Result_9 = IDL.Variant({
    'ok' : IDL.Tuple(
      RecoverySession,
      IDL.Vec(KeyShare),
      IDL.Opt(IDL.Vec(IDL.Nat8)),
    ),
    'err' : IDL.Text,
  });
  const NoteId = IDL.Text;
  const Result_7 = IDL.Variant({ 'ok' : IDL.Vec(IDL.Nat8), 'err' : IDL.Text });
  const DeviceInfo = IDL.Record({
    'id' : DeviceId,
    'publicKey' : IDL.Vec(IDL.Nat8),
    'name' : IDL.Text,
    'registrationTime' : Time,
    'lastAccessTime' : Time,
  });
  const Result_6 = IDL.Variant({
    'ok' : IDL.Vec(DeviceInfo),
    'err' : IDL.Text,
  });
  const Result_5 = IDL.Variant({ 'ok' : KeyShare, 'err' : IDL.Text });
  const EncryptedNote = IDL.Record({
    'id' : NoteId,
    'title' : IDL.Vec(IDL.Nat8),
    'created' : Time,
    'content' : IDL.Vec(IDL.Nat8),
    'updated' : Time,
  });
  const Result_4 = IDL.Variant({ 'ok' : EncryptedNote, 'err' : IDL.Text });
  const UserProfile = IDL.Record({
    'totalGuardians' : IDL.Nat,
    'requiredShares' : IDL.Nat,
    'principal' : IDL.Principal,
    'recoveryEnabled' : IDL.Bool,
    'publicRecoveryData' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'devices' : IDL.Vec(DeviceInfo),
  });
  const Result_3 = IDL.Variant({ 'ok' : UserProfile, 'err' : IDL.Text });
  const Result_2 = IDL.Variant({
    'ok' : IDL.Tuple(RecoverySession, UserProfile),
    'err' : IDL.Text,
  });
  const GuardianAction = IDL.Variant({
    'Add' : IDL.Null,
    'Remove' : IDL.Null,
    'Replace' : IDL.Principal,
  });
  const Result_1 = IDL.Variant({ 'ok' : NoteId, 'err' : IDL.Text });
  return IDL.Service({
    'activateRecoveredAccount' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Vec(IDL.Nat8)],
        [Result_8],
        [],
      ),
    'addDevice' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat8), IDL.Vec(IDL.Nat8)],
        [Result_8],
        [],
      ),
    'approveRecovery' : IDL.Func([IDL.Principal], [Result], []),
    'collectRecoveryData' : IDL.Func([IDL.Principal], [Result_9], []),
    'createProfile' : IDL.Func([IDL.Nat, IDL.Nat], [Result], []),
    'createProfileWithDevice' : IDL.Func(
        [IDL.Nat, IDL.Nat, IDL.Text, IDL.Vec(IDL.Nat8)],
        [Result_8],
        [],
      ),
    'deleteNote' : IDL.Func([NoteId], [Result], []),
    'finalizeRecovery' : IDL.Func(
        [IDL.Principal, IDL.Principal, IDL.Vec(IDL.Nat8)],
        [Result],
        [],
      ),
    'getAccessKey' : IDL.Func([], [Result_7], []),
    'getDevices' : IDL.Func([], [Result_6], []),
    'getMyGuardians' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Bool))],
        [],
      ),
    'getMyKeyShare' : IDL.Func([IDL.Principal], [Result_5], []),
    'getNote' : IDL.Func([NoteId], [Result_4], []),
    'getNotes' : IDL.Func([], [IDL.Vec(EncryptedNote)], []),
    'getProfile' : IDL.Func([], [Result_3], []),
    'getRecoveryStatus' : IDL.Func([IDL.Principal], [Result_2], []),
    'initiateRecovery' : IDL.Func([IDL.Principal], [Result], []),
    'manageGuardian' : IDL.Func(
        [
          IDL.Principal,
          GuardianAction,
          IDL.Opt(IDL.Vec(IDL.Nat8)),
          IDL.Opt(IDL.Text),
        ],
        [Result],
        [],
      ),
    'removeDevice' : IDL.Func([DeviceId], [Result], []),
    'resetRecovery' : IDL.Func([IDL.Principal], [Result], []),
    'saveNote' : IDL.Func(
        [NoteId, IDL.Vec(IDL.Nat8), IDL.Vec(IDL.Nat8)],
        [Result_1],
        [],
      ),
    'setPublicRecoveryData' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], []),
    'storeKeyShare' : IDL.Func(
        [ShareId, IDL.Vec(IDL.Nat8), IDL.Principal],
        [Result],
        [],
      ),
    'submitRecoveryShare' : IDL.Func([IDL.Principal, ShareId], [Result], []),
    'updateNote' : IDL.Func(
        [NoteId, IDL.Vec(IDL.Nat8), IDL.Vec(IDL.Nat8)],
        [Result],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };