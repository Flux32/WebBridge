using System;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class WebBridgeUI : MonoBehaviour
    {
        public static WebBridgeUI Instance { get; private set; }

        // Reflects React-side TransitionScreen state — set on OpenStarted /
        // cleared on CloseFinished events from React.
        public bool IsTransitionScreenOpen { get; private set; }

        public event Action TransitionScreenOpenStarted;
        public event Action TransitionScreenOpenFinished;
        public event Action TransitionScreenCloseStarted;
        public event Action TransitionScreenCloseFinished;

        // Latched phase of the CURRENT React transition cycle. React owns the
        // lifecycle and fires these phases on its own clock; a follower that
        // subscribes LATE (Unity still booting after an F5, slow 3G) would
        // otherwise miss OpenFinished/CloseStarted entirely and the bonus would
        // never enter. We remember the phase so a late subscriber can catch up
        // via ReplayMissedTransitionPhases. Reset to None on CloseFinished so a
        // finished cycle never replays into the NEXT transition's subscriber.
        public enum TransitionPhase
        {
            None = 0,
            OpenStarted = 1,
            OpenFinished = 2,
            CloseStarted = 3,
            CloseFinished = 4,
        }

        public TransitionPhase CurrentPhase { get; private set; } = TransitionPhase.None;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogError($"Instance {nameof(WebBridgeUI)} already exists.");
                Destroy(gameObject);
                return;
            }

            Instance = this;
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        // ───────────────────────── React → Unity ─────────────────────────
        // React owns the TransitionScreen lifecycle entirely now. It opens
        // gates after YouWinFreeGames is dismissed (bonus start) or after
        // receiving the `BonusEnded` signal from Unity (bonus end), runs its
        // IN/IDLE/OUT animations, and notifies Unity at each phase via the
        // SendMessage receivers below. Unity doesn't initiate the open/close.

        public void OnTransitionScreenOpenStarted()
        {
            Debug.Log("[WebBridgeUI] OnTransitionScreenOpenStarted received from React");
            IsTransitionScreenOpen = true;
            // New cycle begins — arm the latch (clears any stale CloseFinished).
            CurrentPhase = TransitionPhase.OpenStarted;
            TransitionScreenOpenStarted?.Invoke();
        }

        public void OnTransitionScreenOpenFinished()
        {
            int subscriberCount = TransitionScreenOpenFinished?.GetInvocationList().Length ?? 0;
            Debug.Log($"[WebBridgeUI] OnTransitionScreenOpenFinished received from React — subscribers={subscriberCount}");
            CurrentPhase = TransitionPhase.OpenFinished;
            TransitionScreenOpenFinished?.Invoke();
        }

        public void OnTransitionScreenCloseStarted()
        {
            Debug.Log("[WebBridgeUI] OnTransitionScreenCloseStarted received from React");
            CurrentPhase = TransitionPhase.CloseStarted;
            TransitionScreenCloseStarted?.Invoke();
        }

        public void OnTransitionScreenCloseFinished()
        {
            int subscriberCount = TransitionScreenCloseFinished?.GetInvocationList().Length ?? 0;
            Debug.Log($"[WebBridgeUI] OnTransitionScreenCloseFinished received from React — subscribers={subscriberCount}");
            IsTransitionScreenOpen = false;
            // Cycle finished — disarm the latch so it can't replay into the next
            // transition's early subscriber. CloseFinished always arrives live.
            CurrentPhase = TransitionPhase.None;
            TransitionScreenCloseFinished?.Invoke();
        }

        // Catch a late subscriber up to the CURRENT transition cycle: invoke the
        // phase handlers that already fired before it subscribed, in order. Only
        // OpenFinished/CloseStarted can be "stuck" — CloseFinished is the live
        // terminator and resets the latch to None. Handlers must be idempotent
        // (SpinsBonus nulls its pending action after the first call), so this is
        // safe even if a live event also arrives.
        public void ReplayMissedTransitionPhases(Action onOpenFinished, Action onCloseStarted)
        {
            TransitionPhase phase = CurrentPhase;
            if (phase >= TransitionPhase.OpenFinished) onOpenFinished?.Invoke();
            if (phase >= TransitionPhase.CloseStarted) onCloseStarted?.Invoke();
        }
    }
}
