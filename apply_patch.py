import sys
import subprocess

def run_git_apply():
    try:
        # Check if git applies cleanly
        subprocess.run(['git', 'apply', 'patch.diff'], check=True)
        print("Patch applied cleanly.")
    except Exception as e:
        print(f"Error applying patch: {e}")
        
if __name__ == "__main__":
    run_git_apply()
