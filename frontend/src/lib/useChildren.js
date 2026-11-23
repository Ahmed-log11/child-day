// The family: the real list from the backend, or the demo family while on mock data.
import { getChildren, getSession, USE_MOCKS } from "../api/client";
import { useData } from "./useData";
import { useColorVersion } from "./children";

export function useChildren() {
  const colors = useColorVersion();
  const state = useData(() => (USE_MOCKS ? getSession("s1").then((s) => s.children) : getChildren()), []);
  return { ...state, children: state.data ?? [], colors };
}
