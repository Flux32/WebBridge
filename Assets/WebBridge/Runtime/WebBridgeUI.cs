using System;
using UnityEngine;
using UnityEngine.Scripting;

using WebBridge;

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

        // Latched phase + id of the CURRENT React transition cycle. React owns
        // the lifecycle and fires phases on its own clock; a follower that
        // subscribes LATE (Unity still booting after an F5 / slow 3G) can miss
        // OpenFinished/CloseStarted — or even the WHOLE cycle — before it gets to
        // subscribe. We keep the last phase (NOT reset on CloseFinished) plus a
        // per-cycle id so a late subscriber can detect WHICH cycle this is and
        // replay the phases it missed. TransitionCycleId bumps on each
        // OpenStarted — that's what lets a subscriber tell a freshly-finished
        // cycle (replay it) from a stale earlier one it already handled (skip).
        public enum TransitionPhase
        {
            None = 0,
            OpenStarted = 1,
            OpenFinished = 2,
            CloseStarted = 3,
            CloseFinished = 4,
        }

        public TransitionPhase CurrentPhase { get; private set; } = TransitionPhase.None;
        public int TransitionCycleId { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                WebBridgeLogger.LogError($"Instance {nameof(WebBridgeUI)} already exists.");
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
            WebBridgeLogger.Log("[WebBridgeUI] OnTransitionScreenOpenStarted received from React");
            IsTransitionScreenOpen = true;
            // New cycle begins — bump the id and arm the phase latch.
            TransitionCycleId++;
            CurrentPhase = TransitionPhase.OpenStarted;
            TransitionScreenOpenStarted?.Invoke();
        }

        public void OnTransitionScreenOpenFinished()
        {
            int subscriberCount = TransitionScreenOpenFinished?.GetInvocationList().Length ?? 0;
            WebBridgeLogger.Log($"[WebBridgeUI] OnTransitionScreenOpenFinished received from React — subscribers={subscriberCount}");
            CurrentPhase = TransitionPhase.OpenFinished;
            TransitionScreenOpenFinished?.Invoke();
        }

        public void OnTransitionScreenCloseStarted()
        {
            WebBridgeLogger.Log("[WebBridgeUI] OnTransitionScreenCloseStarted received from React");
            CurrentPhase = TransitionPhase.CloseStarted;
            TransitionScreenCloseStarted?.Invoke();
        }

        public void OnTransitionScreenCloseFinished()
        {
            int subscriberCount = TransitionScreenCloseFinished?.GetInvocationList().Length ?? 0;
            WebBridgeLogger.Log($"[WebBridgeUI] OnTransitionScreenCloseFinished received from React — subscribers={subscriberCount}");
            IsTransitionScreenOpen = false;
            // Keep the phase latched at CloseFinished (do NOT reset to None): a
            // follower that subscribes only AFTER the whole cycle finished still
            // needs to see that it ran. Replaying into the next flow is prevented
            // by the cycle id (TransitionCycleId), not by clearing the phase.
            CurrentPhase = TransitionPhase.CloseFinished;
            TransitionScreenCloseFinished?.Invoke();
        }
    }
}
