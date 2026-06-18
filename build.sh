#!/bin/bash
# build.sh - Cross-platform build script for webweb
# Builds release binaries for multiple platforms
#
# Usage:
#   ./build.sh          # Build for current platform only
#   ./build.sh --all    # Build for all platforms (requires cross-compilation tools)
#
# Requirements:
#   - Rust toolchain (rustup, cargo)
#   - For Windows: sudo apt install mingw-w64 && rustup target add x86_64-pc-windows-gnu
#   - For macOS: osxcross toolchain (or build on macOS)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DIST_DIR="dist"
BINARY_NAME="webweb"

# Ensure we're in the project root
cd "$(dirname "$0")"

# Create dist directory
mkdir -p "$DIST_DIR"

# Function to build for a specific target
build_target() {
    local target=$1
    local platform=$2

    echo -e "${YELLOW}Building for ${platform} (${target})...${NC}"

    # Install target if not already installed
    rustup target add "$target" 2>/dev/null || true

    # Build release
    cargo build --release --target "$target"

    # Determine binary extension
    local ext=""
    if [[ "$target" == *"windows"* ]]; then
        ext=".exe"
    fi

    # Copy binary to dist
    local src="target/${target}/release/${BINARY_NAME}${ext}"
    local dst="${DIST_DIR}/${BINARY_NAME}-${platform}${ext}"

    if [ -f "$src" ]; then
        cp "$src" "$dst"
        echo -e "${GREEN}  -> ${dst}${NC}"
    else
        echo -e "${RED}  Error: Binary not found at ${src}${NC}"
        return 1
    fi
}

# Parse arguments
BUILD_ALL=false
for arg in "$@"; do
    case $arg in
        --all)
            BUILD_ALL=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--all]"
            echo ""
            echo "Options:"
            echo "  --all    Build for all platforms (requires cross-compilation tools)"
            echo "  --help   Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Get current platform
CURRENT_ARCH=$(uname -m)
CURRENT_OS=$(uname -s)

echo "=========================================="
echo "  WebWeb Cross-Platform Build"
echo "=========================================="
echo ""

# Always build for current platform
if [[ "$CURRENT_OS" == "Linux" ]]; then
    build_target "x86_64-unknown-linux-gnu" "linux-x86_64"
elif [[ "$CURRENT_OS" == "Darwin" ]]; then
    if [[ "$CURRENT_ARCH" == "arm64" ]]; then
        build_target "aarch64-apple-darwin" "macos-arm64"
    else
        build_target "x86_64-apple-darwin" "macos-x86_64"
    fi
else
    echo -e "${RED}Unsupported platform: ${CURRENT_OS}${NC}"
    exit 1
fi

# Build for other platforms if --all flag is set
if [ "$BUILD_ALL" = true ]; then
    echo ""

    # Linux (always available)
    if [[ "$CURRENT_OS" != "Linux" ]]; then
        build_target "x86_64-unknown-linux-gnu" "linux-x86_64"
    fi

    # macOS (requires osxcross on non-macOS)
    if [[ "$CURRENT_OS" != "Darwin" ]]; then
        echo -e "${YELLOW}Skipping macOS targets (requires macOS host or osxcross)${NC}"
    fi

    # Windows (requires mingw-w64)
    if command -v x86_64-w64-mingw32-gcc &> /dev/null; then
        build_target "x86_64-pc-windows-gnu" "windows-x86_64"
    else
        echo -e "${YELLOW}Skipping Windows target (mingw-w64 not installed)${NC}"
        echo "  Install with: sudo apt install mingw-w64"
    fi
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Build complete!${NC}"
echo "=========================================="
echo ""
echo "Binaries in ${DIST_DIR}/:"
ls -lh "$DIST_DIR"/ 2>/dev/null || echo "  (empty)"
echo ""
