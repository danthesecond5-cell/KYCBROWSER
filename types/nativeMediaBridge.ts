export type NativeGumOfferPayload = {
  requestId: string;
  offer: RTCSessionDescriptionInit;
  constraints?: MediaStreamConstraints;
  rtcConfig?: RTCConfiguration;
};

export type NativeGumAnswerPayload = {
  requestId: string;
  answer: RTCSessionDescriptionInit;
};

export type NativeGumIcePayload = {
  requestId: string;
  candidate: RTCIceCandidateInit;
};

export type NativeGumErrorPayload = {
  requestId: string;
  message: string;
  code?: string;
};

export type NativeGumCancelPayload = {
  requestId: string;
};
